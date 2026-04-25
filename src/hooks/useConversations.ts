import { useCallback } from 'react';
import type { Conversation } from '../types/types';

export function useConversations(
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>,
  setMessages: React.Dispatch<React.SetStateAction<any[]>>,
  setActiveConversationId: React.Dispatch<React.SetStateAction<string | null>>,
) {
  const refreshConversations = useCallback(async () => {
    const list = await window.chatApi.conversations.list();
    setConversations(list);
  }, []);

  const refreshMessages = useCallback(async (convId?: string | null) => {
    if (!convId) {
      setMessages([]);
      return;
    }
    const list = await window.chatApi.messages.get(convId);
    setMessages(list);
  }, []);

  const createConversation = useCallback(
    async (title: string) => {
      const conv = await window.chatApi.conversations.create(title);
      await refreshConversations();
      return conv;
    },
    [refreshConversations]
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      await window.chatApi.conversations.delete(id);
      await refreshConversations();
      setActiveConversationId((currentId) => {
        if (currentId === id) {
          setMessages([]);
          return null;
        }
        return currentId;
      });
    },
    [refreshConversations, setMessages]
  );

  const updateConversationTitle = useCallback(
    async (id: string, title: string) => {
      await window.chatApi.conversations.updateTitle(id, title);
      await refreshConversations();
    },
    [refreshConversations]
  );

  return { refreshConversations, refreshMessages, createConversation, deleteConversation, updateConversationTitle };
}
