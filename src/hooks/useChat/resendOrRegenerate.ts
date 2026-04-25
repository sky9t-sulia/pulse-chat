import type { Provider, Message } from '../../types/types';

interface ResendOrRegenerateArgs {
  type: 'resend' | 'regenerate';
  messageId: string;
  provider: Provider;
  model?: string;
  activeConversationId: string | null;
  isStreaming: boolean;
  deleteMessage: (id: string) => void;
  messagesRef: React.MutableRefObject<Message[]>;
  send: (content: string, provider: Provider, model?: string, conversationIdOverride?: string) => Promise<void>;
  responseIdRef: React.MutableRefObject<Record<string, string>>;
}

export async function resendOrRegenerate(args: ResendOrRegenerateArgs) {
  const { type, messageId, provider, model, activeConversationId, isStreaming, deleteMessage, messagesRef, send, responseIdRef } = args;

  const convId = activeConversationId;
  if (!convId || isStreaming) return;

  const messages = messagesRef.current;
  const idx = messages.findIndex((message) => message.id === messageId);
  if (idx === -1) return;

  if (type === 'resend' && messages[idx].role !== 'user') return;
  if (type === 'regenerate' && messages[idx].role !== 'assistant') return;

  let userContent: string;
  let userIdx: number;

  if (type === 'resend') {
    userContent = messages[idx].content;
    userIdx = idx;
  } else {
    // Find the user message before this assistant message
    userIdx = -1;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userIdx = i;
        break;
      }
    }
    if (userIdx === -1) return;
    userContent = messages[userIdx].content;
  }

  delete responseIdRef.current[convId];
  for (let i = messages.length - 1; i >= userIdx; i--) {
    deleteMessage(messages[i].id);
  }
  await send(userContent, provider, model, convId);
}
