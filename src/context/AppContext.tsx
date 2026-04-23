import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Conversation, Message, Provider, ThemeMode } from '../types';

export const LMSTUDIO_ENDPOINTS = [
  '/api/v1/chat',
  '/v1/responses',
  '/v1/chat/completions',
  '/v1/messages',
] as const;

export const DEFAULT_ENDPOINTS: Record<Provider['api_type'], readonly string[]> = {
  openai: ['/v1/chat/completions'],
  lmstudio: LMSTUDIO_ENDPOINTS,
};

export function getFullChatUrl(provider: Provider): string {
  const base = provider.api_url.replace(/\/+$/, '');
  const endpoint = provider.endpoint.replace(/^\/+/, '');
  return `${base}/${endpoint}`;
}

interface AppContextType {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  providers: Provider[];
  activeProvider: Provider | null;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  setActiveProvider: (provider: Provider | null) => void;
  setActiveConversationId: (id: string | null) => void;
  refreshConversations: () => Promise<void>;
  refreshMessages: () => Promise<void>;
  refreshProviders: () => Promise<void>;
  createConversation: (title: string) => Promise<Conversation>;
  deleteConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => Promise<void>;
  addMessage: (
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    model?: string,
    reasoning?: string
  ) => Promise<Message>;
  deleteMessages: (conversationId: string) => Promise<void>;
  addProvider: (provider: Omit<Provider, 'id' | 'created_at' | 'updated_at'>) => Promise<Provider>;
  updateProvider: (id: string, provider: Omit<Provider, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [activeProvider, setActiveProvider] = useState<Provider | null>(null);
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('chat-theme');
    return (saved as ThemeMode) || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('chat-theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
  }, []);

  const refreshConversations = useCallback(async () => {
    const list = await window.chatApi.conversations.list();
    setConversations(list);
  }, []);

  const refreshMessages = useCallback(async () => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    const list = await window.chatApi.messages.get(activeConversationId);
    setMessages(list as Message[]);
  }, [activeConversationId]);

  const refreshProviders = useCallback(async () => {
    const list = await window.chatApi.providers.list();
    // Backward compatibility: ensure all providers have a models array
    const normalized = list.map((p) => ({
      ...p,
      models: p.models ?? (p.model_info ? [{ key: p.default_model, model_info: p.model_info }] : []),
    }));
    setProviders(normalized);
    if (normalized.length > 0 && !activeProvider) {
      setActiveProvider(normalized[0]);
    }
  }, [activeProvider]);

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
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
    },
    [refreshConversations, activeConversationId]
  );

  const updateConversationTitle = useCallback(
    async (id: string, title: string) => {
      await window.chatApi.conversations.updateTitle(id, title);
      await refreshConversations();
    },
    [refreshConversations]
  );

  const addMessage = useCallback(
    async (conversationId: string, role: 'user' | 'assistant', content: string, model?: string, reasoning?: string) => {
      const msg = await window.chatApi.messages.add(conversationId, role, content, model, reasoning);
      setMessages((prev) => [...prev, msg as Message]);
      return msg as Message;
    },
    []
  );

  const deleteMessages = useCallback(async (conversationId: string) => {
    await window.chatApi.messages.delete(conversationId);
    setMessages([]);
  }, []);

  const addProvider = useCallback(
    async (provider: Omit<Provider, 'id' | 'created_at' | 'updated_at'>) => {
      const newProvider = await window.chatApi.providers.create({
        ...provider,
        api_type: provider.api_type ?? 'openai',
        endpoint: provider.endpoint ?? '/v1/chat/completions',
        models: provider.models ?? [],
      });
      await refreshProviders();
      return newProvider;
    },
    [refreshProviders]
  );

  const updateProvider = useCallback(
    async (id: string, provider: Omit<Provider, 'id' | 'created_at' | 'updated_at'>) => {
      await window.chatApi.providers.update(id, {
        ...provider,
        api_type: provider.api_type ?? 'openai',
        endpoint: provider.endpoint ?? '/v1/chat/completions',
        models: provider.models ?? [],
      });
      await refreshProviders();
    },
    [refreshProviders]
  );

  const deleteProvider = useCallback(
    async (id: string) => {
      await window.chatApi.providers.delete(id);
      await refreshProviders();
      if (activeProvider?.id === id) {
        setActiveProvider(null);
      }
    },
    [refreshProviders, activeProvider]
  );

  // Auto-select first conversation on load
  useEffect(() => {
    refreshConversations();
    refreshProviders();
  }, [refreshConversations, refreshProviders]);

  useEffect(() => {
    refreshMessages();
  }, [refreshMessages]);

  const value: AppContextType = {
    conversations,
    activeConversationId,
    messages,
    providers,
    activeProvider,
    theme,
    setTheme,
    setActiveProvider,
    setActiveConversationId,
    refreshConversations,
    refreshMessages,
    refreshProviders,
    createConversation,
    deleteConversation,
    updateConversationTitle,
    addMessage,
    deleteMessages,
    addProvider,
    updateProvider,
    deleteProvider,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
