import { useRef, useEffect, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useToolRegistry } from '../context/tools';
import type { Provider } from '../types/types';
import type { LoadingPhase, TokenStats, ToolInvocation } from '../types/streaming-api';
import { sendMessage } from './useChat/sendMessage';
import { resendOrRegenerate } from './useChat/resendOrRegenerate';

export type { LoadingPhase, TokenStats, ToolInvocation };

export function useChat() {
  const { messages, activeConversationId, addMessage, deleteMessage, chatSettings, updateConversationTitle, userSettings } = useApp();
  const { toolDefinitions } = useToolRegistry();
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingReasoningContent, setStreamingReasoningContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>({ kind: 'idle' });
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [toolInvocations, setToolInvocations] = useState<ToolInvocation[]>([]);
  const cancelRef = useRef<(() => void) | null>(null);
  const messagesRef = useRef(messages);
  const responseIdRef = useRef<Record<string, string>>({});
  const isStreamingRef = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    if (isStreaming) return;
    const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
    if (lastAssistant && (lastAssistant.input_tokens || lastAssistant.output_tokens)) {
      setTokenStats({
        input_tokens: lastAssistant.input_tokens || 0,
        total_output_tokens: lastAssistant.output_tokens || 0,
        reasoning_output_tokens: lastAssistant.reasoning_tokens || 0,
      });
    } else {
      setTokenStats(null);
    }
  }, [activeConversationId, isStreaming, messages]);

  const scrollRef = useRef<HTMLDivElement>(null!);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const threshold = 120;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    if (isNearBottom) {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent, streamingReasoningContent]);

  const send = useCallback(
    async (content: string, provider: Provider, model?: string, conversationIdOverride?: string) => {
      await sendMessage({
        content,
        provider,
        model,
        conversationIdOverride,
        activeConversationId,
        isStreaming: isStreamingRef.current,
        addMessage,
        chatSettings,
        userContext: { name: userSettings.name, gender: userSettings.gender, bio: userSettings.bio },
        toolDefinitions,
        updateConversationTitle,
        messagesRef,
        responseIdRef,
        streamingState: {
          setStreamingContent,
          setStreamingReasoningContent,
          setIsStreaming,
          setLoadingPhase,
          setTokenStats,
          setToolInvocations,
        },
        cancelRef,
      });
    },
    [activeConversationId, addMessage, chatSettings, toolDefinitions, updateConversationTitle]
  );

  const stop = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setIsStreaming(false);
    setLoadingPhase({ kind: 'idle' });
  }, []);

  const resendMessage = useCallback(
    async (messageId: string, provider: Provider, model?: string) => {
      await resendOrRegenerate({
        type: 'resend',
        messageId,
        provider,
        model,
        activeConversationId,
        isStreaming: isStreamingRef.current,
        deleteMessage,
        messagesRef,
        send,
        responseIdRef,
      });
    },
    [activeConversationId, deleteMessage, send]
  );

  const regenerateMessage = useCallback(
    async (messageId: string, provider: Provider, model?: string) => {
      await resendOrRegenerate({
        type: 'regenerate',
        messageId,
        provider,
        model,
        activeConversationId,
        isStreaming: isStreamingRef.current,
        deleteMessage,
        messagesRef,
        send,
        responseIdRef,
      });
    },
    [activeConversationId, deleteMessage, send]
  );

  return {
    streamingContent,
    streamingReasoningContent,
    isStreaming,
    loadingPhase,
    tokenStats,
    toolInvocations,
    scrollRef,
    scrollContainerRef,
    send,
    stop,
    resendMessage,
    regenerateMessage,
  };
}
