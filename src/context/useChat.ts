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
  messages: { role: string; content: string }[]
): Record<string, unknown> {
  switch (kind) {
    case 'lmstudio-chat':
      return {
        model,
        input: messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n'),
        stream: true,
      };
    case 'lmstudio-responses':
      return {
        model,
        input: messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n'),
        stream: true,
      };
    case 'lmstudio-messages':
      return {
        model,
        max_tokens: 2048,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      };
    default:
      return {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      };
  }
}

function parseSSE(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (text: string) => void,
  onReasoningChunk: (text: string) => void,
  onLoadingPhase: (phase: LoadingPhase) => void,
  onStats: (stats: TokenStats) => void,
  onDone: () => void,
  onError: (msg: string) => void
): () => void {
  const decoder = new TextDecoder();
  let buffer = '';
  let abortController: AbortController | null = null;

  abortController = new AbortController();

  const cancel = () => {
    abortController?.abort();
    try {
      reader.cancel();
    } catch {
      // already closed
    }
  };

  const process = async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let i = 0;
        while (i < lines.length) {
          const line = lines[i];

          // Detect event: type lines (LM Studio native format)
          if (line.startsWith('event:')) {
            const eventType = line.slice(6).trim();
            i++;
            if (i >= lines.length) break;
            const dataLine = lines[i];
            if (!dataLine.startsWith('data:')) {
              i++;
              continue;
            }
            const data = dataLine.slice(5).trim();
            i++;

            try {
              const json = JSON.parse(data);

              // Loading / processing events
              switch (eventType) {
                case 'model_load.start':
                  onLoadingPhase({ kind: 'model_load', progress: 0 });
                  break;
                case 'model_load.progress':
                  onLoadingPhase({ kind: 'model_load', progress: json.progress ?? 0 });
                  break;
                case 'model_load.end':
                  onLoadingPhase({ kind: 'idle' }); // model loaded, will switch to prompt_processing
                  break;
                case 'prompt_processing.start':
                  onLoadingPhase({ kind: 'prompt_processing', progress: 0 });
                  break;
                case 'prompt_processing.progress':
                  onLoadingPhase({ kind: 'prompt_processing', progress: json.progress ?? 0 });
                  break;
                case 'prompt_processing.end':
                  onLoadingPhase({ kind: 'idle' }); // prompt processed, about to stream
                  break;
                case 'reasoning.start':
                  onLoadingPhase({ kind: 'streaming' });
                  break;
                case 'message.start':
                  onLoadingPhase({ kind: 'streaming' });
                  break;
                case 'message.delta':
                  onLoadingPhase({ kind: 'streaming' });
                  onChunk(json.content ?? '');
                  break;
                case 'reasoning.delta':
                  onLoadingPhase({ kind: 'streaming' });
                  onReasoningChunk(json.content ?? '');
                  break;
                case 'response.output_text.delta':
                  onLoadingPhase({ kind: 'streaming' });
                  onChunk(json.text ?? '');
                  break;
                case 'content_block_delta':
                  onLoadingPhase({ kind: 'streaming' });
                  onChunk(json.delta?.text ?? '');
                  break;
                case 'response.completed':
                  // Final event from /v1/responses with exact token stats
                  if (json.stats) {
                    onStats(json.stats as TokenStats);
                  }
                  break;
              }
            } catch {
              // skip malformed JSON
            }
            continue;
          }

          // Standard data: line format (OpenAI)
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (!data || data === '[DONE]') {
              i++;
              continue;
            }

            try {
              const json = JSON.parse(data);
              const contentChunk = json.choices?.[0]?.delta?.content;
              if (contentChunk) {
                onLoadingPhase({ kind: 'streaming' });
                onChunk(contentChunk);
              }
            } catch {
              // skip malformed JSON
            }
          }

          i++;
        }
      }

      onDone();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      onError(err instanceof Error ? err.message : 'Stream error');
    }
  };

  process();
  return cancel;
}

export function useChat() {
  const { messages, activeConversationId, addMessage } = useApp();
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingReasoningContent, setStreamingReasoningContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>({ kind: 'idle' });
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null!);
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, streamingReasoningContent]);

  const send = useCallback(
    async (content: string, provider: Provider, model?: string, conversationIdOverride?: string) => {
      // Use override if provided, otherwise fall back to state
      const convId = conversationIdOverride || activeConversationId;
      if (!convId || isStreaming) return;

      await addMessage(convId, 'user', content);

      const chatMessages = messages
        .concat({ id: '', role: 'user', content, created_at: Date.now() } as Message)
        .map((m) => ({ role: m.role, content: m.content }));

      // Use provided model, or fall back to provider's default
      const usedModel = model || provider.default_model;
      const kind = getApiKind(provider);
      const chatUrl = getFullChatUrl(provider);
      const body = buildRequestBody(kind, usedModel, chatMessages);

      setIsStreaming(true);
      setStreamingContent('');
      setStreamingReasoningContent('');
      setLoadingPhase({ kind: 'idle' });
      setTokenStats(null);

      let currentContent = '';
      let currentReasoningContent = '';

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

        cancelRef.current = parseSSE(
          reader,
          (text) => {
            currentContent += text;
            setStreamingContent(currentContent);
          },
          (text) => {
            currentReasoningContent += text;
            setStreamingReasoningContent(currentReasoningContent);
          },
          (phase) => {
            setLoadingPhase(phase);
          },
          (stats) => {
            setTokenStats(stats);
          },
          () => {
            cancelRef.current = null;
          },
          (msg) => {
            setStreamingContent(`[Error: ${msg}]`);
            setIsStreaming(false);
            setLoadingPhase({ kind: 'idle' });
          }
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setStreamingContent(`[Error: ${msg}]`);
        setIsStreaming(false);
        setLoadingPhase({ kind: 'idle' });
      }

      if (currentContent) {
        await addMessage(
          convId,
          'assistant',
          currentContent,
          usedModel,
          currentReasoningContent || undefined
        );
      }

      setStreamingContent('');
      setStreamingReasoningContent('');
      setIsStreaming(false);
      setLoadingPhase({ kind: 'idle' });
      setTokenStats(null);
    },
    [activeConversationId, isStreaming, messages, addMessage]
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
