import type { ApiMessage, ApiToolCall, TokenStats } from '../../types/streaming-api';
import { buildRequestBody } from '../../helpers/api-helpers';
import { buildThinkBuffer } from '../../helpers/think-buffer';
import type { JsonChunk } from '../../helpers/json-types';
import { handleJsonChunk, type StreamState } from '../../helpers/stream-handler';
import type { StreamingCallbacks } from '../../types/streaming-api';
import type { UserContext } from '../../helpers/system-prompt';

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
  userContext?: UserContext,
  onError?: (message: string) => void,
): Promise<StreamResult> {
  const streamBody = buildRequestBody(
    model,
    streamMessages,
    userSystemPrompt,
    responseIdRef[streamConvId],
    tools,
    userContext,
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
      let userMessage: string;
      if (response.status === 401) {
        userMessage = 'Authentication failed. Check your API key in settings.';
      } else if (response.status === 404) {
        userMessage = `Model not found. Check that the model is available at your provider's URL.`;
      } else if (response.status >= 500) {
        userMessage = `Server error (${response.status}). The provider's server may be temporarily unavailable.`;
      } else {
        userMessage = `Request failed (${response.status}): ${errorText.slice(0, 200)}`;
      }
      callbacks.onError(userMessage);
      callbacks.onPhase({ kind: 'idle' });
      onError?.(userMessage);
      return EMPTY_RESULT;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      const userMessage = 'No stream available from the server.';
      callbacks.onError(userMessage);
      callbacks.onPhase({ kind: 'idle' });
      onError?.(userMessage);
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

            const json = JSON.parse(data) as JsonChunk;
            const eventType = currentEventType || json.type;

            // Handle SSE error events — throw out of the streaming loop
            if (eventType === 'error') {
              const errorObj = json as unknown as Record<string, unknown>;
              const errorMsg = errorObj.error
                ? typeof errorObj.error === 'string'
                  ? errorObj.error
                  : ((errorObj.error as Record<string, unknown>)?.message
                    ? String((errorObj.error as Record<string, unknown>)?.message)
                    : JSON.stringify(errorObj.error))
                : errorObj.message
                  ? String(errorObj.message)
                  : 'Stream error occurred.';
              throw new Error(errorMsg as string);
            }

            Object.assign(state, handleJsonChunk({ ...json, type: eventType }, state));
            accumulatedContent = state.accumulatedContent;
            accumulatedReasoning = state.accumulatedReasoning;
            finalStats = state.finalStats;
            Object.assign(toolCallsByIndex, state.toolCallsByIndex);
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
    let userMessage: string;
    // SSE error events already have user-friendly messages
    if (msg.includes('Model unloaded') || msg.includes('Stream error')) {
      userMessage = msg;
    } else if (msg.includes('fetch') || msg.includes('NetworkError') || msg.includes('Failed to fetch')) {
      userMessage = 'Failed to connect. Check your internet connection and provider settings.';
    } else if (msg.includes('abort') || msg.includes('canceled')) {
      userMessage = 'Request was cancelled.';
    } else {
      userMessage = `Connection error: ${msg}`;
    }
    callbacks.onError(userMessage);
    callbacks.onPhase({ kind: 'idle' });
    onError?.(userMessage);
    return EMPTY_RESULT;
  }

  const toolCalls: ApiToolCall[] = Object.keys(toolCallsByIndex)
    .map((indexKey) => Number(indexKey))
    .sort((indexA, indexB) => indexA - indexB)
    .map((index) => {
      const toolCallEntry = toolCallsByIndex[index];
      return {
        id: toolCallEntry.id || `call_${index}`,
        type: 'function' as const,
        function: { name: toolCallEntry.name, arguments: toolCallEntry.args || '{}' },
      } as ApiToolCall;
    })
    .filter((toolCall) => toolCall.function.name);

  return {
    content: accumulatedContent,
    reasoning: accumulatedReasoning,
    stats: finalStats,
    toolCalls,
  };
}
