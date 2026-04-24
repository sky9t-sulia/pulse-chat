import { useRef, useEffect, useState, useCallback } from 'react';
import { useApp, getFullChatUrl } from './AppContext';
import type { Provider, Message } from '../types';

type ApiKind = 'openai' | 'lmstudio-chat' | 'lmstudio-responses' | 'lmstudio-messages';
export type LoadingPhase =
  | { kind: 'idle' }
  | { kind: 'model_load'; progress: number }
  | { kind: 'prompt_processing'; progress: number }
  | { kind: 'streaming' };

export interface TokenStats {
  input_tokens: number;
  total_output_tokens: number;
  reasoning_output_tokens: number;
}

function getApiKind(provider: Provider): ApiKind {
  if (provider.api_type === 'openai') return 'openai';
  if (provider.endpoint === '/api/v1/chat') return 'lmstudio-chat';
  if (provider.endpoint === '/v1/responses') return 'lmstudio-responses';
  if (provider.endpoint === '/v1/messages') return 'lmstudio-messages';
  return 'openai';
}

function buildRequestBody(
  kind: ApiKind,
  model: string,
  messages: { role: string; content: string }[],
  previousResponseId?: string
): Record<string, unknown> {
  const latestUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  switch (kind) {
    case 'lmstudio-chat': {
      const body: Record<string, unknown> = {
        model,
        input: latestUserMsg?.content ?? '',
        stream: true,
      };
      if (previousResponseId) body.previous_response_id = previousResponseId;
      return body;
    }
    case 'lmstudio-responses': {
      const body: Record<string, unknown> = {
        model,
        input: latestUserMsg?.content ?? '',
        stream: true,
      };
      if (previousResponseId) body.previous_response_id = previousResponseId;
      return body;
    }
    case 'lmstudio-messages':
      return {
        model,
        max_tokens: 2048,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      };
    default: {
      const body: Record<string, unknown> = {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      };
      if (previousResponseId) body.previous_response_id = previousResponseId;
      return body;
    }
  }
}

export function useChat() {
  const { messages, activeConversationId, addMessage } = useApp();
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingReasoningContent, setStreamingReasoningContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>({ kind: 'idle' });
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const messagesRef = useRef(messages);
  const responseIdRef = useRef<Record<string, string>>({});

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const scrollRef = useRef<HTMLDivElement>(null!);
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, streamingReasoningContent]);

  const send = useCallback(
    async (content: string, provider: Provider, model?: string, conversationIdOverride?: string) => {
      // Use override if provided, otherwise fall back to state
      const convId = conversationIdOverride || activeConversationId;
      if (!convId || isStreaming) return;

      // Use provided model, or fall back to provider's default
      const usedModel = model || provider.default_model;

      await addMessage(convId, 'user', content, usedModel);

      const chatMessages = messagesRef.current
        .concat({ id: '', role: 'user', content, created_at: Date.now() } as Message)
        .map((m) => ({ role: m.role, content: m.content }));
      const kind = getApiKind(provider);
      const chatUrl = getFullChatUrl(provider);
      const body = buildRequestBody(kind, usedModel, chatMessages, responseIdRef.current[convId]);

      setIsStreaming(true);
      setStreamingContent('');
      setStreamingReasoningContent('');
      setLoadingPhase({ kind: 'idle' });

      let accumulatedContent = '';
      let accumulatedReasoningContent = '';

      try {
        const fetchInit: RequestInit = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        };

        // Auth headers vary by endpoint
        if (provider.api_type === 'openai') {
          fetchInit.headers = {
            ...fetchInit.headers,
            Authorization: `Bearer ${provider.api_key}`,
          };
        } else if (provider.endpoint === '/v1/messages') {
          fetchInit.headers = {
            ...fetchInit.headers,
            'x-api-key': provider.api_key,
            'anthropic-version': '2023-06-01',
          };
        } else {
          if (provider.api_key) {
            fetchInit.headers = {
              ...fetchInit.headers,
              Authorization: `Bearer ${provider.api_key}`,
            };
          }
        }

        const response = await fetch(chatUrl, fetchInit);

        if (!response.ok) {
          const errorText = await response.text();
          setStreamingContent(`[Error ${response.status}: ${errorText}]`);
          setIsStreaming(false);
          setLoadingPhase({ kind: 'idle' });
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          setStreamingContent('[Error: No stream available]');
          setIsStreaming(false);
          setLoadingPhase({ kind: 'idle' });
          return;
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
                  const json = JSON.parse(data);

                  // Use json.type as fallback if currentEventType is empty
                  // (LM Studio sometimes omits event: lines)
                  const eventType = currentEventType || json.type;

                  switch (eventType) {
                    case 'model_load.start':
                      setLoadingPhase({ kind: 'model_load', progress: 0 });
                      break;
                    case 'response.created':
                      // Extract response_id for next request
                      if (json.id) {
                        responseIdRef.current[convId] = json.id;
                      }
                      break;
                    case 'model_load.progress':
                      setLoadingPhase({ kind: 'model_load', progress: json.progress ?? 0 });
                      break;
                    case 'model_load.end':
                      setLoadingPhase({ kind: 'idle' });
                      break;
                    case 'prompt_processing.start':
                      setLoadingPhase({ kind: 'prompt_processing', progress: 0 });
                      break;
                    case 'prompt_processing.progress':
                      setLoadingPhase({ kind: 'prompt_processing', progress: json.progress ?? 0 });
                      break;
                    case 'prompt_processing.end':
                      setLoadingPhase({ kind: 'idle' });
                      break;
                    case 'reasoning.start':
                    case 'reasoning_start':
                      setLoadingPhase({ kind: 'streaming' });
                      break;
                    case 'message.start':
                    case 'message_start':
                      setLoadingPhase({ kind: 'streaming' });
                      break;
                    case 'message.delta':
                    case 'message_delta':
                      setLoadingPhase({ kind: 'streaming' });
                      if (json.content) {
                        accumulatedContent += json.content;
                        setStreamingContent(accumulatedContent);
                      }
                      // LM Studio may include reasoning alongside content in message delta
                      // or nested in json.delta.reasoning (Anthropic-style)
                      const reasoningFromMessage = json.reasoning ?? json.delta?.reasoning ?? '';
                      if (reasoningFromMessage) {
                        accumulatedReasoningContent += reasoningFromMessage;
                        setStreamingReasoningContent(accumulatedReasoningContent);
                      }
                      break;
                    case 'reasoning.delta':
                    case 'reasoning_delta':
                      setLoadingPhase({ kind: 'streaming' });
                      // LM Studio may send reasoning in json.content or json.reasoning
                      const reasoningText = json.content ?? json.reasoning ?? '';
                      if (reasoningText) {
                        accumulatedReasoningContent += reasoningText;
                        setStreamingReasoningContent(accumulatedReasoningContent);
                      }
                      break;
                    case 'response.output_text.delta':
                      setLoadingPhase({ kind: 'streaming' });
                      if (json.text) {
                        accumulatedContent += json.text;
                        setStreamingContent(accumulatedContent);
                      }
                      break;
                    case 'content_block_delta':
                      setLoadingPhase({ kind: 'streaming' });
                      if (json.delta?.text) {
                        accumulatedContent += json.delta.text;
                        setStreamingContent(accumulatedContent);
                      }
                      break;
                    case 'response.completed':
                      if (json.stats) {
                        setTokenStats(json.stats as TokenStats);
                      }
                      break;
                    case 'chat.end':
                      // chat.end contains the FULL reasoning and message content
                      // This is the most reliable source for the complete content
                      if (json.result?.output) {
                        for (const item of json.result.output) {
                          if (item.type === 'reasoning' && item.content) {
                            accumulatedReasoningContent = item.content;
                            setStreamingReasoningContent(accumulatedReasoningContent);
                          } else if (item.type === 'message' && item.content) {
                            accumulatedContent = item.content;
                            setStreamingContent(accumulatedContent);
                          }
                        }
                      }
                      // Also extract token stats from chat.end
                      if (json.result?.stats) {
                        setTokenStats(json.result.stats as TokenStats);
                      } else if (json.stats) {
                        // Some LM Studio versions send stats at top level
                        setTokenStats(json.stats as TokenStats);
                      }
                      // Also store response_id from chat.end result
                      if (json.result?.response_id) {
                        responseIdRef.current[convId] = json.result.response_id;
                      } else if (json.result?.id) {
                        responseIdRef.current[convId] = json.result.id;
                      }
                      break;
                    default:
                      // OpenAI format (no event: prefix) or unrecognized event
                      if (json.choices?.[0]?.delta?.content) {
                        setLoadingPhase({ kind: 'streaming' });
                        accumulatedContent += json.choices[0].delta.content;
                        setStreamingContent(accumulatedContent);
                      }
                      // LM Studio may include reasoning alongside content in message delta
                      if (json.reasoning) {
                        accumulatedReasoningContent += json.reasoning;
                        setStreamingReasoningContent(accumulatedReasoningContent);
                      }
                      break;
                  }
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
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setStreamingContent(`[Error: ${msg}]`);
        setIsStreaming(false);
        setLoadingPhase({ kind: 'idle' });
      }

      if (accumulatedContent) {
        const msg = await addMessage(
          convId,
          'assistant',
          accumulatedContent,
          usedModel,
          accumulatedReasoningContent || undefined,
          tokenStats?.input_tokens,
          tokenStats?.total_output_tokens,
          tokenStats?.reasoning_output_tokens
        );
        // Restore token stats from the message we just saved
        setTokenStats({
          input_tokens: msg.input_tokens || 0,
          total_output_tokens: msg.output_tokens || 0,
          reasoning_output_tokens: msg.reasoning_tokens || 0,
        });
      }

      setStreamingContent('');
      setStreamingReasoningContent('');
      setIsStreaming(false);
      setLoadingPhase({ kind: 'idle' });
    },
    [activeConversationId, isStreaming, addMessage]
  );

  const stop = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setIsStreaming(false);
    setLoadingPhase({ kind: 'idle' });
  }, []);

  return {
    streamingContent,
    streamingReasoningContent,
    isStreaming,
    loadingPhase,
    tokenStats,
    scrollRef,
    send,
    stop,
  };
}
