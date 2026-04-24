import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Conversation, Message, Provider, ThemeMode, ChatSettings, ChatFontFamily } from '../types';

export const CHAT_FONT_STACKS: Record<ChatFontFamily, string> = {
  system: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
  sans: `system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
  serif: `Georgia, Cambria, 'Times New Roman', Times, serif`,
  mono: `'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace`,
  inter: `Inter, system-ui, -apple-system, sans-serif`,
};

export const CHAT_FONT_SIZE_STEPS = [12, 13, 14, 15, 16, 17, 18, 19, 20] as const;

const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  system_prompt: '',
  font_family: 'system',
  font_size: 16,
};

function loadChatSettings(): ChatSettings {
  try {
    const raw = localStorage.getItem('chat-settings');
    if (!raw) return DEFAULT_CHAT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      system_prompt: typeof parsed.system_prompt === 'string' ? parsed.system_prompt : '',
      font_family: CHAT_FONT_STACKS[parsed.font_family as ChatFontFamily]
        ? (parsed.font_family as ChatFontFamily)
        : 'system',
      font_size:
        typeof parsed.font_size === 'number' &&
        (CHAT_FONT_SIZE_STEPS as readonly number[]).includes(parsed.font_size)
          ? parsed.font_size
          : 16,
    };
  } catch {
    return DEFAULT_CHAT_SETTINGS;
  }
}

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
  chatSettings: ChatSettings;
  setChatSettings: (settings: ChatSettings) => void;
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
    reasoning?: string,
    inputTokens?: number,
    outputTokens?: number,
    reasoningTokens?: number
  ) => Promise<Message>;
  deleteMessages: (conversationId: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
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
  const [activeProvider, setActiveProviderState] = useState<Provider | null>(null);

  const setActiveProvider = useCallback((p: Provider | null) => {
    setActiveProviderState(p);
    if (p) {
      localStorage.setItem('active-provider-id', p.id);
    } else {
      localStorage.removeItem('active-provider-id');
    }
  }, []);
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('chat-theme');
    return (saved as ThemeMode) || 'dark';
  });
  const [chatSettings, setChatSettingsState] = useState<ChatSettings>(loadChatSettings);

  useEffect(() => {
    localStorage.setItem('chat-theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('chat-settings', JSON.stringify(chatSettings));
    const root = document.documentElement;
    root.style.setProperty('--chat-font-family', CHAT_FONT_STACKS[chatSettings.font_family]);
    root.style.setProperty('--chat-font-size', `${chatSettings.font_size}px`);
  }, [chatSettings]);

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
  }, []);

  const setChatSettings = useCallback((s: ChatSettings) => {
    setChatSettingsState(s);
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
    // and that every model has model_info with max_context_length
    const normalized = list.map((p) => ({
      ...p,
      models: (p.models ?? (p.model_info ? [{ key: p.default_model, model_info: p.model_info }] : [])).map((m: any) => {
        const info = m.model_info ?? {};
        // If model_info is missing max_context_length, try to get it from the model object itself
        // (LM Studio API puts max_context_length directly on model objects)
        const maxCtx = info.max_context_length ?? (m.max_context_length as number);
        return {
          ...m,
          model_info: maxCtx ? { ...info, max_context_length: maxCtx } : info,
        };
      }),
    }));
    setProviders(normalized);
    if (normalized.length > 0 && !activeProvider) {
      const savedId = localStorage.getItem('active-provider-id');
      const restored = savedId ? normalized.find((p) => p.id === savedId) : null;
      setActiveProvider(restored ?? normalized[0]);
    }
  }, [activeProvider, setActiveProvider]);

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
    async (
      conversationId: string,
      role: 'user' | 'assistant',
      content: string,
      model?: string,
      reasoning?: string,
      inputTokens?: number,
      outputTokens?: number,
      reasoningTokens?: number
    ) => {
      const msg = await window.chatApi.messages.add(
        conversationId,
        role,
        content,
        model,
        reasoning,
        inputTokens,
        outputTokens,
        reasoningTokens
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
  }, [activeConversationId]);

  const value: AppContextType = {
    conversations,
    activeConversationId,
    messages,
    providers,
    activeProvider,
    theme,
    setTheme,
    chatSettings,
    setChatSettings,
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
    deleteMessage,
    addProvider,
    updateProvider,
    deleteProvider,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
