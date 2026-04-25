import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Conversation, Message, Provider, ToolInvocationRecord } from '../types/types';
import { getFullChatUrl } from '../helpers/url';
import { useSettings } from '../hooks/useSettings';
import { useConversations } from '../hooks/useConversations';
import { useMessages } from '../hooks/useMessages';
import { useProviders } from '../hooks/useProviders';

export { getFullChatUrl };

interface AppContextType {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  providers: Provider[];
  activeProvider: Provider | null;
  activeModel: string;
  setActiveModel: (modelKey: string) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  chatSettings: import('../types/types').ChatSettings;
  setChatSettings: (settings: import('../types/types').ChatSettings) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
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
    reasoningTokens?: number,
    durationMs?: number,
    toolInvocations?: ToolInvocationRecord[] | null
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
  const [activeModel, setActiveModel] = useState<string>('');

  const { theme, setTheme, chatSettings, setChatSettings } = useSettings();

  const [showSettings, setShowSettings] = useState(false);

  const setActiveProvider = useCallback((provider: Provider | null) => {
    setActiveProviderState(provider);
    if (provider) {
      const firstEnabled = provider.models?.find((model) => model.enabled !== false)?.key;
      setActiveModel(provider.default_model || firstEnabled || '');
      localStorage.setItem('active-provider-id', provider.id);
    } else {
      setActiveModel('');
      localStorage.removeItem('active-provider-id');
    }
  }, []);

  const { refreshConversations, refreshMessages, createConversation, deleteConversation, updateConversationTitle } = useConversations(
    setConversations,
    setMessages,
    setActiveConversationId,
  );

  const { addMessage, deleteMessages, deleteMessage } = useMessages(setMessages);

  const { refreshProviders, addProvider, updateProvider, deleteProvider } = useProviders(
    setProviders,
    activeProvider,
    setActiveProvider,
  );

  useEffect(() => {
    refreshConversations();
    refreshProviders();
  }, [refreshConversations, refreshProviders]);

  useEffect(() => {
    refreshMessages(activeConversationId);
  }, [activeConversationId]);

  const value: AppContextType = {
    conversations,
    activeConversationId,
    messages,
    providers,
    activeProvider,
    activeModel,
    setActiveModel,
    theme,
    setTheme,
    chatSettings,
    setChatSettings,
    showSettings,
    setShowSettings,
    setActiveProvider,
    setActiveConversationId,
    refreshConversations,
    refreshMessages: () => refreshMessages(activeConversationId),
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
