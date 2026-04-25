import type { Provider, Message } from '../../types/types';
import type { LoadingPhase, ApiMessage, ApiToolCall, TokenStats, ToolInvocation } from '../../types/chat-api';
import { getFullChatUrl } from '../../helpers/url';
import { buildStreamingCallbacks } from '../../helpers/build-streaming-callbacks';
import { executeToolCalls } from './executeToolCalls';
import { saveFinalMessage } from './saveFinalMessage';

export interface StreamingState {
  setStreamingContent: (s: string) => void;
  setStreamingReasoningContent: (s: string) => void;
  setIsStreaming: (v: boolean) => void;
  setLoadingPhase: (p: LoadingPhase) => void;
  setTokenStats: (s: TokenStats | null) => void;
  setToolInvocations: (invocations: ToolInvocation[]) => void;
}

export interface SendMessageArgs {
  content: string;
  provider: Provider;
  model?: string;
  conversationIdOverride?: string;
  activeConversationId: string | null;
  isStreaming: boolean;
  addMessage: (
    convId: string,
    role: "user" | "assistant",
    content: string,
    model?: string,
    reasoning?: string,
    inputTokens?: number,
    outputTokens?: number,
    reasoningTokens?: number,
    durationMs?: number,
    toolInvocations?: ToolInvocation[] | null
  ) => Promise<Message>;
  chatSettings: { system_prompt: string; max_calls_per_tool?: number };
  toolDefinitions: unknown[] | null;
  updateConversationTitle: (convId: string, title: string) => Promise<void>;
  messagesRef: React.MutableRefObject<Message[]>;
  responseIdRef: React.MutableRefObject<Record<string, string>>;
  streamingState: StreamingState;
  cancelRef: React.MutableRefObject<(() => void) | null>;
}

export async function sendMessage(args: SendMessageArgs) {
  const {
    content, provider, model, conversationIdOverride,
    activeConversationId, isStreaming, addMessage, chatSettings,
    toolDefinitions, updateConversationTitle, messagesRef, responseIdRef,
    streamingState, cancelRef,
  } = args;

  const convId = conversationIdOverride || activeConversationId;
  if (!convId || isStreaming) return;

  const usedModel = model || provider.default_model;

  await addMessage(convId, 'user', content, usedModel);
  const chatMessages: ApiMessage[] = [
    ...messagesRef.current.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content },
  ];
  const chatUrl = getFullChatUrl(provider);

  streamingState.setIsStreaming(true);
  streamingState.setLoadingPhase({ kind: 'waiting' });
  streamingState.setStreamingContent('');
  streamingState.setStreamingReasoningContent('');
  streamingState.setToolInvocations([]);

  const collectedInvocations: ToolInvocation[] = [];
  const toolCallCounts: Record<string, number> = {};
  const maxCallsPerTool = Math.max(1, chatSettings.max_calls_per_tool || 3);
  let accumulatedContent = '';
  let accumulatedReasoningContent = '';
  let finalStats: TokenStats | null = null;
  let firstContentAt: number | null = null;
  const requestStartedAt = Date.now();

  const { streamResponse } = await import('./streaming');
  const callbacks = buildStreamingCallbacks(streamingState);

  const streamResponseWithCallbacks = async (
    streamMessages: ApiMessage[],
    streamConvId: string,
  ): Promise<{ content: string; reasoning: string; stats: TokenStats | null; toolCalls: ApiToolCall[] }> => {
    return streamResponse(
      usedModel,
      streamMessages,
      streamConvId,
      chatUrl,
      chatSettings.system_prompt,
      provider.api_key,
      toolDefinitions as Record<string, unknown>[] | undefined,
      responseIdRef.current,
      cancelRef,
      callbacks,
    );
  };

  // Main streaming loop — handles tool calls iteratively
  let loopMessages: ApiMessage[] = [...chatMessages];
  let loopResult = await streamResponseWithCallbacks(loopMessages, convId);
  let maxLoops = 10;

  while (maxLoops > 0) {
    accumulatedContent = loopResult.content;
    accumulatedReasoningContent = loopResult.reasoning;
    finalStats = loopResult.stats;
    if (firstContentAt === null && (accumulatedContent || accumulatedReasoningContent)) {
      firstContentAt = Date.now();
    }

    if (loopResult.toolCalls.length === 0) break;

    loopMessages = [
      ...loopMessages,
      { role: 'assistant', content: accumulatedContent || null, tool_calls: loopResult.toolCalls },
    ];

    const { toolMessages } = await executeToolCalls(
      loopResult.toolCalls,
      collectedInvocations,
      toolCallCounts,
      maxCallsPerTool,
      streamingState.setToolInvocations,
    );

    loopMessages.push(...toolMessages);
    streamingState.setStreamingContent('');
    streamingState.setStreamingReasoningContent('');
    streamingState.setLoadingPhase({ kind: 'waiting' });
    loopResult = await streamResponseWithCallbacks(loopMessages, convId);
    maxLoops--;
  }

  // Final: save the message and finish
  if (accumulatedContent) {
    await saveFinalMessage({
      content: accumulatedContent,
      reasoning: accumulatedReasoningContent,
      stats: finalStats,
      toolInvocations: collectedInvocations,
      provider,
      model: usedModel,
      convId,
      messagesRef,
      addMessage,
      updateConversationTitle,
      setStreamingContent: streamingState.setStreamingContent,
      setStreamingReasoningContent: streamingState.setStreamingReasoningContent,
      setToolInvocations: streamingState.setToolInvocations,
      setIsStreaming: streamingState.setIsStreaming,
      setLoadingPhase: streamingState.setLoadingPhase,
      requestStartedAt,
    });
    return;
  }

  streamingState.setStreamingContent('');
  streamingState.setStreamingReasoningContent('');
  streamingState.setToolInvocations([]);
  streamingState.setIsStreaming(false);
  streamingState.setLoadingPhase({ kind: 'idle' });
}
