import type { ApiMessage, ApiToolCall, TokenStats } from '../../types/chat-api';
import { buildRequestBody } from '../../helpers/api-helpers';
import { buildThinkBuffer } from '../../helpers/think-buffer';
import type { JsonChunk } from '../../helpers/json-types';
import type { StreamState } from '../../helpers/stream-handler';
import type { StreamingCallbacks } from '../../types/chat-api';
import { handleJsonChunk } from '../../helpers/stream-handler';

interface StreamResult {
  content: string;
  reasoning: string;
  stats: TokenStats | null;
  toolCalls: ApiToolCall[];
}

const EMPTY_RESULT: StreamResult = { content: '', reasoning: '', stats: null, toolCalls: [] };

export async function streamResponse(
  model: string,
  streamMessages: ApiMessage[],
  streamConvId: string,
  chatUrl: string,
  userSystemPrompt: string,
  providerApiKey: string,
  tools: Record<string, unknown>[] | undefined,
  responseIdRef: Record<string, string>,
  cancelRef: React.MutableRefObject<(() => void) | null>,
  callbacks: StreamingCallbacks,
): Promise<StreamResult> {
  const streamBody = buildRequestBody(
    model,
    streamMessages,
    userSystemPrompt,
    responseIdRef[streamConvId],
    tools,
  );

  let accumulatedContent = '';
  let accumulatedReasoning = '';
  let finalStats: TokenStats | null = null;
  const toolCallsByIndex: Record<number, { id: string; name: string; args: string }> = {};

  const { route, flush } = buildThinkBuffer();

  const state: StreamState = {
    accumulatedContent: '',
    accumulatedReasoning: '',
    finalStats: null,
    firstContentAt: null,
    toolCallsByIndex: {},
    responseIdRef,
    streamConvId,
    route,
    callbacks,
  };

  try {
    const fetchInit: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${providerApiKey}`,
      },
      body: JSON.stringify(streamBody),
    };

    const response = await fetch(chatUrl, fetchInit);

    if (!response.ok) {
      const errorText = await response.text();
      callbacks.onError(`[Error ${response.status}: ${errorText}]`);
      callbacks.onPhase({ kind: 'idle' });
      return EMPTY_RESULT;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError('[Error: No stream available]');
      callbacks.onPhase({ kind: 'idle' });
      return EMPTY_RESULT;
    }

    cancelRef.current = () => {
      cancelRef.current = null;
      reader.cancel();
    };

    const decoder = new TextDecoder();
    let buffer = '';
    let currentEventType = '';

    try {
      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEventType = line.slice(6).trim();
            continue;
          }

          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (!data || data === '[DONE]') {
              currentEventType = '';
              continue;
            }

            try {
              const json = JSON.parse(data) as JsonChunk;
              const eventType = currentEventType || json.type;

              Object.assign(state, handleJsonChunk({ ...json, type: eventType }, state));
              accumulatedContent = state.accumulatedContent;
              accumulatedReasoning = state.accumulatedReasoning;
              finalStats = state.finalStats;
              Object.assign(toolCallsByIndex, state.toolCallsByIndex);
            } catch {
              // skip malformed JSON
            }

            currentEventType = '';
          }
        }
      }
    } finally {
      cancelRef.current = null;
    }

    flush(
      (chunk) => { accumulatedContent += chunk; callbacks.onContent(accumulatedContent); },
      (chunk) => { accumulatedReasoning += chunk; callbacks.onReasoning(accumulatedReasoning); },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    callbacks.onError(`[Error: ${msg}]`);
    callbacks.onPhase({ kind: 'idle' });
    return EMPTY_RESULT;
  }

  const toolCalls: ApiToolCall[] = Object.keys(toolCallsByIndex)
    .map((k) => Number(k))
    .sort((a, b) => a - b)
    .map((idx) => {
      const e = toolCallsByIndex[idx];
      return {
        id: e.id || `call_${idx}`,
        type: 'function' as const,
        function: { name: e.name, arguments: e.args || '{}' },
      } as ApiToolCall;
    })
    .filter((tc) => tc.function.name);

  return {
    content: accumulatedContent,
    reasoning: accumulatedReasoning,
    stats: finalStats,
    toolCalls,
  };
}
