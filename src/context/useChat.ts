import { useRef, useEffect, useState, useCallback } from 'react';
import { useApp, getFullChatUrl } from './AppContext';
import { useToolRegistry } from './tools';
import type { Provider } from '../types';

export type LoadingPhase =
  | { kind: 'idle' }
  | { kind: 'waiting' }
  | { kind: 'streaming' };

export interface TokenStats {
  input_tokens: number;
  total_output_tokens: number;
  reasoning_output_tokens: number;
  tokens_per_second?: number;
}

export interface ToolInvocation {
  id: string;
  name: string;
  arguments: string;
  status: 'running' | 'done' | 'error';
  result?: string;
  error?: string;
  durationMs?: number;
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

interface ApiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface ApiMessage {
  role: string;
  content: string | null;
  tool_calls?: ApiToolCall[];
  tool_call_id?: string;
  name?: string;
}

function buildRequestBody(
  model: string,
  messages: ApiMessage[],
  userSystemPrompt: string,
  previousResponseId?: string,
  tools?: Record<string, unknown>[],
): Record<string, unknown> {
  const systemPrompt = composeSystemPrompt(userSystemPrompt);
  const withSystem: ApiMessage[] = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;
  const body: Record<string, unknown> = {
    model,
    messages: withSystem.map((m) => {
      const out: Record<string, unknown> = { role: m.role, content: m.content };
      if (m.tool_calls) out.tool_calls = m.tool_calls;
      if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
      if (m.name) out.name = m.name;
      return out;
    }),
    stream: true,
    stream_options: { include_usage: true },
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
  }
  if (previousResponseId) body.previous_response_id = previousResponseId;
  return body;
}

async function generateTitle(
  provider: Provider,
  model: string,
  userMessage: string,
  assistantMessage: string,
): Promise<string | null> {
  const prompt = `Summarize the following chat in 3-6 words as a short title. Respond with only the title — no quotes, no trailing punctuation.\n\nUser: ${userMessage.slice(0, 500)}\nAssistant: ${assistantMessage.slice(0, 500)}`;
  const chatUrl = getFullChatUrl(provider);

  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${provider.api_key}`,
  };

  try {
    const res = await fetch(chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const raw =
      data?.choices?.[0]?.message?.content ??
      null;

    if (typeof raw !== 'string') return null;
    const cleaned = raw
      .replace(/^["'""''\s]+|["'""''\s.,!?]+$/g, '')
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

  // Execute a tool via IPC
  const executeTool = useCallback(async (toolName: string, toolArgsJson: string) => {
    const result = await window.chatApi.tools.execute(toolName, toolArgsJson);
    return result;
  }, []);

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
      const chatMessages: ApiMessage[] = full.map((m) => ({ role: m.role, content: m.content }));
      const chatUrl = getFullChatUrl(provider);

      setIsStreaming(true);
      setLoadingPhase({ kind: 'waiting' });
      setStreamingContent('');
      setStreamingReasoningContent('');
      setToolInvocations([]);
      const collectedInvocations: ToolInvocation[] = [];
      const toolCallCounts: Record<string, number> = {};
      const maxCallsPerTool = Math.max(1, chatSettings.max_calls_per_tool || 3);

      let accumulatedContent = '';
      let accumulatedReasoningContent = '';
      let finalStats: TokenStats | null = null;
      let firstContentAt: number | null = null;
      const requestStartedAt = Date.now();

      // Stream helper — reuses the fetch+read logic
      type StreamResult = {
        content: string;
        reasoning: string;
        stats: TokenStats | null;
        toolCalls: ApiToolCall[];
      };

      const emptyResult: StreamResult = {
        content: '',
        reasoning: '',
        stats: null,
        toolCalls: [],
      };

      const streamResponse = async (
        streamMessages: ApiMessage[],
        streamConvId: string,
      ): Promise<StreamResult> => {
        const streamBody = buildRequestBody(
          usedModel,
          streamMessages,
          chatSettings.system_prompt,
          responseIdRef.current[streamConvId],
          (toolDefinitions as Record<string, unknown>[]) || undefined,
        );

        let streamAccumulatedContent = '';
        let streamAccumulatedReasoningContent = '';
        let streamFinalStats: TokenStats | null = null;
        let streamFirstContentAt: number | null = null;
        const toolCallsByIndex: Record<number, { id: string; name: string; args: string }> = {};

        // Models like DeepSeek R1 / QwQ / Qwen3-thinking emit <think>...</think> in content.
        // Route the tagged segment into reasoning; deliver the rest as content.
        let thinkBuffer = '';
        let insideThink = false;
        const routeContent = (chunk: string) => {
          thinkBuffer += chunk;
          while (thinkBuffer.length > 0) {
            if (insideThink) {
              const end = thinkBuffer.indexOf('</think>');
              if (end === -1) {
                // Hold back the last 7 chars in case `</think` is split across chunks
                const safe = thinkBuffer.length > 7 ? thinkBuffer.slice(0, -7) : '';
                if (safe) {
                  streamAccumulatedReasoningContent += safe;
                  thinkBuffer = thinkBuffer.slice(safe.length);
                }
                break;
              }
              streamAccumulatedReasoningContent += thinkBuffer.slice(0, end);
              thinkBuffer = thinkBuffer.slice(end + '</think>'.length);
              insideThink = false;
            } else {
              const start = thinkBuffer.indexOf('<think>');
              if (start === -1) {
                const safe = thinkBuffer.length > 6 ? thinkBuffer.slice(0, -6) : '';
                if (safe) {
                  streamAccumulatedContent += safe;
                  thinkBuffer = thinkBuffer.slice(safe.length);
                }
                break;
              }
              streamAccumulatedContent += thinkBuffer.slice(0, start);
              thinkBuffer = thinkBuffer.slice(start + '<think>'.length);
              insideThink = true;
            }
          }
          setStreamingContent(streamAccumulatedContent);
          setStreamingReasoningContent(streamAccumulatedReasoningContent);
        };

        try {
          const fetchInit: RequestInit = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${provider.api_key}`,
            },
            body: JSON.stringify(streamBody),
          };

          const response = await fetch(chatUrl, fetchInit);

          if (!response.ok) {
            const errorText = await response.text();
            setStreamingContent(`[Error ${response.status}: ${errorText}]`);
            setIsStreaming(false);
            setLoadingPhase({ kind: 'idle' });
            return emptyResult;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            setStreamingContent('[Error: No stream available]');
            setIsStreaming(false);
            setLoadingPhase({ kind: 'idle' });
            return emptyResult;
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

                    const eventType = currentEventType || json.type;

                    switch (eventType) {
                      case 'response.created':
                        if (json.id) {
                          responseIdRef.current[streamConvId] = json.id;
                        }
                        break;
                      case 'response.output_text.delta':
                        if (json.text) {
                          streamAccumulatedContent += json.text;
                          if (streamFirstContentAt === null) streamFirstContentAt = Date.now();
                          setStreamingContent(streamAccumulatedContent);
                        }
                        break;
                      case 'response.completed':
                        if (json.stats) {
                          streamFinalStats = json.stats as TokenStats;
                          setTokenStats(streamFinalStats);
                        }
                        break;
                      case 'response.finish':
                        if (json.result?.output) {
                          for (const item of json.result.output) {
                            if (item.type === 'message' && item.content) {
                              streamAccumulatedContent = item.content;
                              if (streamFirstContentAt === null) streamFirstContentAt = Date.now();
                              setStreamingContent(streamAccumulatedContent);
                            }
                          }
                        }
                        if (json.result?.stats) {
                          streamFinalStats = json.result.stats as TokenStats;
                          setTokenStats(streamFinalStats);
                        } else if (json.stats) {
                          streamFinalStats = json.stats as TokenStats;
                          setTokenStats(streamFinalStats);
                        }
                        if (json.result?.response_id) {
                          responseIdRef.current[streamConvId] = json.result.response_id;
                        } else if (json.result?.id) {
                          responseIdRef.current[streamConvId] = json.result.id;
                        }
                        break;
                      default:
                        // OpenAI chat completions streaming format
                        if (json.choices?.[0]?.delta?.content) {
                          setLoadingPhase({ kind: 'streaming' });
                          if (streamFirstContentAt === null) streamFirstContentAt = Date.now();
                          routeContent(json.choices[0].delta.content);
                        }
                        // Tool calls for OpenAI-compatible streams
                        const delta = json.choices?.[0]?.delta;
                        if (delta?.tool_calls) {
                          for (const tc of delta.tool_calls) {
                            const idx = typeof tc.index === 'number' ? tc.index : 0;
                            const entry = toolCallsByIndex[idx] || { id: '', name: '', args: '' };
                            if (tc.id) entry.id = tc.id;
                            if (tc.function?.name) entry.name += tc.function.name;
                            if (tc.function?.arguments) entry.args += tc.function.arguments;
                            toolCallsByIndex[idx] = entry;
                          }
                          setLoadingPhase({ kind: 'streaming' });
                        }
                        // Reasoning — providers use different fields:
                        //   OpenAI o-series / OpenRouter: delta.reasoning (string)
                        //   DeepSeek / many local runners: delta.reasoning_content (string)
                        //   Some: delta.reasoning.content (object with .content)
                        //   Some: delta.thinking / delta.thought
                        let reasoningChunk = '';
                        if (typeof delta?.reasoning === 'string') {
                          reasoningChunk = delta.reasoning;
                        } else if (typeof delta?.reasoning?.content === 'string') {
                          reasoningChunk = delta.reasoning.content;
                        } else if (typeof delta?.reasoning_content === 'string') {
                          reasoningChunk = delta.reasoning_content;
                        } else if (typeof delta?.thinking === 'string') {
                          reasoningChunk = delta.thinking;
                        } else if (typeof delta?.thought === 'string') {
                          reasoningChunk = delta.thought;
                        }
                        if (reasoningChunk) {
                          setLoadingPhase({ kind: 'streaming' });
                          streamAccumulatedReasoningContent += reasoningChunk;
                          setStreamingReasoningContent(streamAccumulatedReasoningContent);
                        }
                        // OpenAI sends usage in the final chunk when stream_options.include_usage is set
                        if (json.usage) {
                          streamFinalStats = {
                            input_tokens: json.usage.prompt_tokens ?? 0,
                            total_output_tokens: json.usage.completion_tokens ?? 0,
                            reasoning_output_tokens:
                              json.usage.completion_tokens_details?.reasoning_tokens ?? 0,
                          };
                          setTokenStats(streamFinalStats);
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

          // Flush any residual text left in the <think> buffer
          if (thinkBuffer.length > 0) {
            if (insideThink) {
              streamAccumulatedReasoningContent += thinkBuffer;
              setStreamingReasoningContent(streamAccumulatedReasoningContent);
            } else {
              streamAccumulatedContent += thinkBuffer;
              setStreamingContent(streamAccumulatedContent);
            }
            thinkBuffer = '';
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          setStreamingContent(`[Error: ${msg}]`);
          setIsStreaming(false);
          setLoadingPhase({ kind: 'idle' });
          return emptyResult;
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
            };
          })
          .filter((tc) => tc.function.name);

        return {
          content: streamAccumulatedContent,
          reasoning: streamAccumulatedReasoningContent,
          stats: streamFinalStats,
          toolCalls,
        };
      };

      // Main streaming loop — handles tool calls iteratively
      let loopMessages: ApiMessage[] = [...chatMessages];
      let loopResult: Awaited<ReturnType<typeof streamResponse>> = emptyResult;
      let maxLoops = 10; // Safety limit

      while (maxLoops > 0) {
        loopResult = await streamResponse(loopMessages, convId);
        accumulatedContent = loopResult.content;
        accumulatedReasoningContent = loopResult.reasoning;
        finalStats = loopResult.stats;
        if (firstContentAt === null && (accumulatedContent || accumulatedReasoningContent)) {
          firstContentAt = Date.now();
        }

        if (loopResult.toolCalls.length === 0) break;

        // Append assistant turn (content + tool_calls) to the conversation we send next
        loopMessages = [
          ...loopMessages,
          {
            role: 'assistant',
            content: accumulatedContent || null,
            tool_calls: loopResult.toolCalls,
          },
        ];

        // Execute each tool call and append its result
        for (const tc of loopResult.toolCalls) {
          const toolName = tc.function.name;
          const count = (toolCallCounts[toolName] || 0) + 1;
          toolCallCounts[toolName] = count;

          const runningEntry: ToolInvocation = {
            id: tc.id,
            name: toolName,
            arguments: tc.function.arguments,
            status: 'running',
          };
          collectedInvocations.push(runningEntry);
          setToolInvocations([...collectedInvocations]);

          const startedAt = Date.now();
          let toolResultContent = '';
          let toolError: string | undefined;

          if (count > maxCallsPerTool) {
            toolError = `Tool '${toolName}' call limit reached (${maxCallsPerTool} per message). Answer the user with what you already have.`;
          } else {
            try {
              const toolRes = await executeTool(toolName, tc.function.arguments);
              toolResultContent = toolRes.content;
              toolError = toolRes.error;
            } catch (err: unknown) {
              toolError = err instanceof Error ? err.message : String(err);
            }
          }

          const durationMs = Date.now() - startedAt;
          runningEntry.status = toolError ? 'error' : 'done';
          runningEntry.result = toolResultContent;
          runningEntry.error = toolError;
          runningEntry.durationMs = durationMs;
          setToolInvocations([...collectedInvocations]);

          loopMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            name: toolName,
            content: toolError ? `[Error: ${toolError}]\n${toolResultContent}` : toolResultContent,
          });
        }

        setStreamingContent('');
        setStreamingReasoningContent('');
        setLoadingPhase({ kind: 'waiting' });
        maxLoops--;
      }

      // Final: save the message and finish
      if (accumulatedContent) {
        const isFirstAssistant = !messagesRef.current.some((m) => m.role === 'assistant');
        const firstUserMsg = messagesRef.current.find((m) => m.role === 'user')?.content ?? '';

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
          durationMs,
          collectedInvocations.length > 0 ? collectedInvocations : null
        );

        setStreamingContent('');
        setStreamingReasoningContent('');
        setToolInvocations([]);
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
      setToolInvocations([]);
      setIsStreaming(false);
      setLoadingPhase({ kind: 'idle' });
    },
    [activeConversationId, isStreaming, addMessage, chatSettings.system_prompt, chatSettings.max_calls_per_tool, updateConversationTitle, toolDefinitions, executeTool]
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
    toolInvocations,
    scrollRef,
    scrollContainerRef,
    send,
    stop,
    resendMessage,
    regenerateMessage,
  };
}
