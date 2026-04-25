import type { Message } from '../../types/types';
import type { TokenStats, ToolInvocation } from '../../types/streaming-api';
import { generateTitle } from '../../helpers/api-helpers';
import type { Provider } from '../../types/types';

export interface FinalMessageData {
  content: string;
  reasoning: string;
  stats: TokenStats | null;
  toolInvocations: ToolInvocation[];
  provider: Provider;
  model: string;
  convId: string;
  messagesRef: { current: Message[] };
  addMessage: (
    convId: string,
    role: 'user' | 'assistant',
    content: string,
    model?: string,
    reasoning?: string,
    inputTokens?: number,
    outputTokens?: number,
    reasoningTokens?: number,
    durationMs?: number,
    toolInvocations?: ToolInvocation[] | null
  ) => Promise<Message>;
  updateConversationTitle: (convId: string, title: string) => Promise<void>;
  setStreamingContent: (content: string) => void;
  setStreamingReasoningContent: (reasoning: string) => void;
  setToolInvocations: (invocations: ToolInvocation[]) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setLoadingPhase: (phase: import('../../types/streaming-api').LoadingPhase) => void;
  requestStartedAt: number;
}

export async function saveFinalMessage(data: FinalMessageData): Promise<void> {
  const {
    content, reasoning, stats, toolInvocations, provider, model, convId,
    messagesRef, addMessage, updateConversationTitle,
    setStreamingContent, setStreamingReasoningContent, setToolInvocations,
    setIsStreaming, setLoadingPhase, requestStartedAt,
  } = data;

  const isFirstAssistant = !messagesRef.current.some((message) => message.role === 'assistant');
  const firstUserMsg = messagesRef.current.find((message) => message.role === 'user')?.content ?? '';

  let durationMs: number;
  if (
    stats?.tokens_per_second &&
    stats.tokens_per_second > 0 &&
    stats.total_output_tokens > 0
  ) {
    durationMs = Math.round(
      (stats.total_output_tokens / stats.tokens_per_second) * 1000
    );
  } else {
    const firstContentAt = messagesRef.current.length > 0
      ? Date.now() - requestStartedAt
      : Date.now() - requestStartedAt;
    durationMs = firstContentAt > 0 ? firstContentAt : Date.now() - requestStartedAt;
  }

  await addMessage(
    convId,
    'assistant',
    content,
    model,
    reasoning || undefined,
    stats?.input_tokens,
    stats?.total_output_tokens,
    stats?.reasoning_output_tokens,
    durationMs,
    toolInvocations.length > 0 ? toolInvocations : null
  );

  setStreamingContent('');
  setStreamingReasoningContent('');
  setToolInvocations([]);
  setIsStreaming(false);
  setLoadingPhase({ kind: 'idle' });

  if (isFirstAssistant) {
    const title = await generateTitle(provider, model, firstUserMsg, content);
    if (title) {
      await updateConversationTitle(convId, title);
    }
  }
}
