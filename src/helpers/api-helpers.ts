import { composeSystemPrompt } from './system-prompt';
import type { Provider } from '../types/types';
import type { ApiMessage } from '../types/chat-api';
import { getFullChatUrl } from './url';

export function buildRequestBody(
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
    messages: withSystem.map((message) => {
      const out: Record<string, unknown> = { role: message.role, content: message.content };
      if (message.tool_calls) out.tool_calls = message.tool_calls;
      if (message.tool_call_id) out.tool_call_id = message.tool_call_id;
      if (message.name) out.name = message.name;
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

export async function generateTitle(
  provider: Provider,
  model: string,
  userMessage: string,
  assistantMessage: string,
): Promise<string | null> {
  const prompt = `Summarize the following chat in 3-6 words as a short title. 
                  Respond with only the title — no quotes, no trailing punctuation.\n\n
                  User: ${userMessage.slice(0, 500)}\nAssistant: ${assistantMessage.slice(0, 500)}`;
                  
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
