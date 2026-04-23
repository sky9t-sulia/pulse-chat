/// <reference types="vite/client" />

interface Conversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

interface Message {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: number;
  model?: string;
}

interface Provider {
  id: string;
  name: string;
  api_url: string;
  api_key: string;
  default_model: string;
  created_at: number;
  updated_at: number;
}

interface ChatAPI {
  conversations: {
    list: () => Promise<Conversation[]>;
    create: (title: string) => Promise<Conversation>;
    delete: (id: string) => Promise<void>;
    get: (id: string) => Promise<Conversation | undefined>;
    updateTitle: (id: string, title: string) => Promise<void>;
  };
  messages: {
    get: (conversationId: string) => Promise<Message[]>;
    add: (conversationId: string, role: string, content: string, model?: string) => Promise<Message>;
    delete: (conversationId: string) => Promise<void>;
  };
  providers: {
    list: () => Promise<Provider[]>;
    create: (provider: Omit<Provider, 'id' | 'created_at' | 'updated_at'>) => Promise<Provider>;
    update: (id: string, provider: Omit<Provider, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
    delete: (id: string) => Promise<void>;
    get: (id: string) => Promise<Provider | undefined>;
  };
}

declare global {
  interface Window {
    chatApi: ChatAPI;
  }
}

export {};
