import { useRef, useEffect, useState, useCallback } from 'react';
import { useApp, getFullChatUrl } from './AppContext';
import type { Provider } from '../types';

type ApiKind = 'openai' | 'lmstudio-chat' | 'lmstudio-responses' | 'lmstudio-messages';
export type LoadingPhase =
  | { kind: 'idle' }
  | { kind: 'waiting' }
  | { kind: 'model_load'; progress: number }
  | { kind: 'prompt_processing'; progress: number }
  | { kind: 'streaming' };

export interface TokenStats {
  input_tokens: number;
  total_output_tokens: number;
  reasoning_output_tokens: number;
  tokens_per_second?: number;
}

function getApiKind(provider: Provider): ApiKind {
  if (provider.api_type === 'openai') return 'openai';
  if (provider.endpoint === '/api/v1/chat') return 'lmstudio-chat';
  if (provider.endpoint === '/v1/responses') return 'lmstudio-responses';
  if (provider.endpoint === '/v1/messages') return 'lmstudio-messages';
  return 'openai';
}

// Hidden base system prompt — prepended to the user-provided system prompt.
// Tells the model how to format output so it renders correctly in the UI.
const BASE_SYSTEM_PROMPT = [
  'Formatting rules for all responses:',
  '- Use GitHub-flavored markdown for headings, lists, tables, and fenced code blocks.',
  '- For code, use fenced blocks with a language tag (```python, ```ts, …). Do not wrap prose in code fences.',
  '- Keep answers concise by default; expand only when the user asks for detail.',
].join('\n');

function composeSystemPrompt(userPrompt: string): string {
  const trimmed = userPrompt.trim();
  if (!trimmed) return BASE_SYSTEM_PROMPT;
  return `${BASE_SYSTEM_PROMPT}\n\n---\n\n${trimmed}`;
}

function buildRequestBody(
  kind: ApiKind,
  model: string,
  messages: { role: string; content: string }[],
  userSystemPrompt: string,
  previousResponseId?: string
): Record<string, unknown> {
  const systemPrompt = composeSystemPrompt(userSystemPrompt);
  const withSystem = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;
  const latestUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  switch (kind) {
    case 'lmstudio-chat':
    case 'lmstudio-responses': {
      // Stateful endpoints — `input` is the new turn only; prior history is
      // tracked server-side via previous_response_id.
      const body: Record<string, unknown> = {
        model,
        input: latestUserMsg?.content ?? '',
        stream: true,
      };
      if (systemPrompt) body.system_prompt = systemPrompt;
      if (previousResponseId) body.previous_response_id = previousResponseId;
      return body;
    }
    case 'lmstudio-messages': {
      // Anthropic Messages API takes system as a top-level field, not a message role
      const body: Record<string, unknown> = {
        model,
        max_tokens: 2048,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      };
      if (systemPrompt) body.system = systemPrompt;
      return body;
    }
    default: {
      const body: Record<string, unknown> = {
        model,
        messages: withSystem.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        stream_options: { include_usage: true },
      };
      if (previousResponseId) body.previous_response_id = previousResponseId;
      return body;
    }
  }
}

async function generateTitle(
  provider: Provider,
  model: string,
  userMessage: string,
  assistantMessage: string
): Promise<string | null> {
  const prompt = `Summarize the following chat in 3-6 words as a short title. Respond with only the title — no quotes, no trailing punctuation.\n\nUser: ${userMessage.slice(0, 500)}\nAssistant: ${assistantMessage.slice(0, 500)}`;
  const kind = getApiKind(provider);
  const chatUrl = getFullChatUrl(provider);

  let body: Record<string, unknown>;
  switch (kind) {
    case 'lmstudio-chat':
    case 'lmstudio-responses':
      body = { model, input: prompt, stream: false };
      break;
    case 'lmstudio-messages':
      body = {
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      };
      break;
    default:
      body = {
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      };
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider.api_type === 'openai') {
    headers.Authorization = `Bearer ${provider.api_key}`;
  } else if (provider.endpoint === '/v1/messages') {
    headers['x-api-key'] = provider.api_key;
    headers['anthropic-version'] = '2023-06-01';
  } else if (provider.api_key) {
    headers.Authorization = `Bearer ${provider.api_key}`;
  }

  try {
    const res = await fetch(chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const raw =
      // OpenAI chat completions
      data?.choices?.[0]?.message?.content ??
      // LM Studio Responses API
      (Array.isArray(data?.output)
        ? data.output
            .filter((o: { type?: string }) => o.type === 'message')
            .map((o: { content?: unknown }) => {
              if (typeof o.content === 'string') return o.content;
              if (Array.isArray(o.content)) {
                return o.content
                  .map((c: { text?: string }) => c.text ?? '')
                  .join('');
              }
              return '';
            })
            .join('')
        : null) ??
      data?.output_text ??
      // Anthropic Messages API
      (Array.isArray(data?.content)
        ? data.content
            .map((c: { text?: string }) => c.text ?? '')
            .join('')
        : null) ??
      null;

    if (typeof raw !== 'string') return null;
    const cleaned = raw
      .replace(/^["'“”‘’\s]+|["'“”‘’\s.,!?]+$/g, '')
      .split('\n')[0]
      .trim();
    if (!cleaned) return null;
    return cleaned.slice(0, 60);
  } catch {
    return null;
  }
}

export function useChat() {
  const { messages, activeConversationId, addMessage, deleteMessage, chatSettings, updateConversationTitle } = useApp();
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

  useEffect(() => {
    if (isStreaming) return;
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
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
      // Use override if provided, otherwise fall back to state
      const convId = conversationIdOverride || activeConversationId;
      if (!convId || isStreaming) return;

      // Use provided model, or fall back to provider's default
      const usedModel = model || provider.default_model;

      const userMsg = await addMessage(convId, 'user', content, usedModel);

      const current = messagesRef.current;
      const full = current.some((m) => m.id === userMsg.id) ? current : current.concat(userMsg);
      const chatMessages = full.map((m) => ({ role: m.role, content: m.content }));
      const kind = getApiKind(provider);
      const chatUrl = getFullChatUrl(provider);
      const body = buildRequestBody(
        kind,
        usedModel,
        chatMessages,
        chatSettings.system_prompt,
        responseIdRef.current[convId]
      );

      setIsStreaming(true);
      setLoadingPhase({ kind: 'waiting' });
      setStreamingContent('');
      setStreamingReasoningContent('');

      let accumulatedContent = '';
      let accumulatedReasoningContent = '';
      let finalStats: TokenStats | null = null;
      let firstContentAt: number | null = null;
      const requestStartedAt = Date.now();

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
                    case 'chat.start':
                      // Server has accepted the request and is about to start work.
                      setLoadingPhase({ kind: 'waiting' });
                      break;
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
                      setLoadingPhase({ kind: 'waiting' });
                      break;
                    case 'prompt_processing.start':
                      setLoadingPhase({ kind: 'prompt_processing', progress: 0 });
                      break;
                    case 'prompt_processing.progress':
                      setLoadingPhase({ kind: 'prompt_processing', progress: json.progress ?? 0 });
                      break;
                    case 'prompt_processing.end':
                      setLoadingPhase({ kind: 'waiting' });
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
                        if (firstContentAt === null) firstContentAt = Date.now();
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
                        if (firstContentAt === null) firstContentAt = Date.now();
                        setStreamingContent(accumulatedContent);
                      }
                      break;
                    case 'content_block_delta':
                      setLoadingPhase({ kind: 'streaming' });
                      if (json.delta?.text) {
                        accumulatedContent += json.delta.text;
                        if (firstContentAt === null) firstContentAt = Date.now();
                        setStreamingContent(accumulatedContent);
                      }
                      break;
                    case 'response.completed':
                      if (json.stats) {
                        finalStats = json.stats as TokenStats;
                        setTokenStats(finalStats);
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
                            if (firstContentAt === null) firstContentAt = Date.now();
                        setStreamingContent(accumulatedContent);
                          }
                        }
                      }
                      // Also extract token stats from chat.end
                      if (json.result?.stats) {
                        finalStats = json.result.stats as TokenStats;
                        setTokenStats(finalStats);
                      } else if (json.stats) {
                        // Some LM Studio versions send stats at top level
                        finalStats = json.stats as TokenStats;
                        setTokenStats(finalStats);
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
                        if (firstContentAt === null) firstContentAt = Date.now();
                        setStreamingContent(accumulatedContent);
                      }
                      // Reasoning for OpenAI-compatible streams:
                      //   - OpenRouter / LM Studio: choices[0].delta.reasoning
                      //   - DeepSeek R1-style: choices[0].delta.reasoning_content
                      //   - LM Studio top-level: json.reasoning
                      {
                        const delta = json.choices?.[0]?.delta;
                        const reasoningChunk =
                          delta?.reasoning ?? delta?.reasoning_content ?? json.reasoning ?? '';
                        if (reasoningChunk) {
                          setLoadingPhase({ kind: 'streaming' });
                          accumulatedReasoningContent += reasoningChunk;
                          setStreamingReasoningContent(accumulatedReasoningContent);
                        }
                      }
                      // OpenAI sends usage in the final chunk when stream_options.include_usage is set
                      if (json.usage) {
                        finalStats = {
                          input_tokens: json.usage.prompt_tokens ?? 0,
                          total_output_tokens: json.usage.completion_tokens ?? 0,
                          reasoning_output_tokens:
                            json.usage.completion_tokens_details?.reasoning_tokens ?? 0,
                        };
                        setTokenStats(finalStats);
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
        const isFirstAssistant = !messagesRef.current.some((m) => m.role === 'assistant');
        const firstUserMsg = messagesRef.current.find((m) => m.role === 'user')?.content ?? '';

        // Prefer provider-reported tokens_per_second (LM Studio) — convert back to
        // a synthetic duration so the displayed tok/s matches exactly. Otherwise
        // fall back to our own timing (OpenAI-compatible providers don't report tps).
        let durationMs: number;
        if (
          finalStats?.tokens_per_second &&
          finalStats.tokens_per_second > 0 &&
          finalStats.total_output_tokens > 0
        ) {
          durationMs = Math.round(
            (finalStats.total_output_tokens / finalStats.tokens_per_second) * 1000
          );
        } else {
          durationMs = firstContentAt
            ? Date.now() - firstContentAt
            : Date.now() - requestStartedAt;
        }

        await addMessage(
          convId,
          'assistant',
          accumulatedContent,
          usedModel,
          accumulatedReasoningContent || undefined,
          finalStats?.input_tokens,
          finalStats?.total_output_tokens,
          finalStats?.reasoning_output_tokens,
          durationMs
        );

        // Clear streaming state now so the saved message replaces the streaming
        // bubble immediately — otherwise a long-running title generation below
        // would leave both visible side-by-side.
        setStreamingContent('');
        setStreamingReasoningContent('');
        setIsStreaming(false);
        setLoadingPhase({ kind: 'idle' });

        if (isFirstAssistant) {
          const title = await generateTitle(provider, usedModel, firstUserMsg, accumulatedContent);
          if (title) {
            await updateConversationTitle(convId, title);
          }
        }
        return;
      }

      setStreamingContent('');
      setStreamingReasoningContent('');
      setIsStreaming(false);
      setLoadingPhase({ kind: 'idle' });
    },
    [activeConversationId, isStreaming, addMessage, chatSettings.system_prompt, updateConversationTitle]
  );

  const stop = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setIsStreaming(false);
    setLoadingPhase({ kind: 'idle' });
  }, []);

  const resendMessage = useCallback(
    async (messageId: string, provider: Provider, model?: string) => {
      const convId = activeConversationId;
      if (!convId || isStreaming) return;
      const msgs = messagesRef.current;
      const idx = msgs.findIndex((m) => m.id === messageId);
      if (idx === -1 || msgs[idx].role !== 'user') return;

      const content = msgs[idx].content;
      delete responseIdRef.current[convId];
      for (let i = msgs.length - 1; i >= idx; i--) {
        await deleteMessage(msgs[i].id);
      }
      await send(content, provider, model, convId);
    },
    [activeConversationId, isStreaming, deleteMessage, send]
  );

  const regenerateMessage = useCallback(
    async (messageId: string, provider: Provider, model?: string) => {
      const convId = activeConversationId;
      if (!convId || isStreaming) return;
      const msgs = messagesRef.current;
      const idx = msgs.findIndex((m) => m.id === messageId);
      if (idx === -1 || msgs[idx].role !== 'assistant') return;

      let userIdx = -1;
      for (let i = idx - 1; i >= 0; i--) {
        if (msgs[i].role === 'user') {
          userIdx = i;
          break;
        }
      }
      if (userIdx === -1) return;

      const userContent = msgs[userIdx].content;
      delete responseIdRef.current[convId];
      for (let i = msgs.length - 1; i >= userIdx; i--) {
        await deleteMessage(msgs[i].id);
      }
      await send(userContent, provider, model, convId);
    },
    [activeConversationId, isStreaming, deleteMessage, send]
  );

  return {
    streamingContent,
    streamingReasoningContent,
    isStreaming,
    loadingPhase,
    tokenStats,
    scrollRef,
    scrollContainerRef,
    send,
    stop,
    resendMessage,
    regenerateMessage,
  };
}
