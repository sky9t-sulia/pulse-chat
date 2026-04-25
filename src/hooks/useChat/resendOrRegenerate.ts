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

  const msgs = messagesRef.current;
  const idx = msgs.findIndex((m) => m.id === messageId);
  if (idx === -1) return;

  if (type === 'resend' && msgs[idx].role !== 'user') return;
  if (type === 'regenerate' && msgs[idx].role !== 'assistant') return;

  let userContent: string;
  let userIdx: number;

  if (type === 'resend') {
    userContent = msgs[idx].content;
    userIdx = idx;
  } else {
    // Find the user message before this assistant message
    userIdx = -1;
    for (let i = idx - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        userIdx = i;
        break;
      }
    }
    if (userIdx === -1) return;
    userContent = msgs[userIdx].content;
  }

  delete responseIdRef.current[convId];
  for (let i = msgs.length - 1; i >= userIdx; i--) {
    deleteMessage(msgs[i].id);
  }
  await send(userContent, provider, model, convId);
}
