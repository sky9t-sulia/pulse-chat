import { useCallback } from 'react';
import type { Message, ToolInvocationRecord } from '../types/types';

export function useMessages(
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
) {
  const addMessage = useCallback(
    async (
      conversationId: string,
      role: 'user' | 'assistant',
      content: string,
      model?: string,
      reasoning?: string,
      inputTokens?: number,
      outputTokens?: number,
      reasoningTokens?: number,
      durationMs?: number,
      toolInvocations?: ToolInvocationRecord[] | null
    ) => {
      const msg = await window.chatApi.messages.add(
        conversationId,
        role,
        content,
        model,
        reasoning,
        inputTokens,
        outputTokens,
        reasoningTokens,
        durationMs,
        toolInvocations
      );
      setMessages((prev) => [...prev, msg as Message]);
      return msg as Message;
    },
    []
  );

  const deleteMessages = useCallback(async (conversationId: string) => {
    await window.chatApi.messages.delete(conversationId);
    setMessages([]);
  }, []);

  const deleteMessage = useCallback(async (id: string) => {
    await window.chatApi.messages.deleteOne(id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return { addMessage, deleteMessages, deleteMessage };
}
