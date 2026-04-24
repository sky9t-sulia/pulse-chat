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
  reasoning?: string;
  created_at: number;
  model?: string;
}

interface Provider {
  id: string;
  name: string;
  api_url: string;
  api_key: string;
  api_type: 'openai' | 'lmstudio';
  endpoint: string;
  default_model: string;
  model_info: ModelInfo | null;
  models: { key: string; display_name?: string; model_info?: ModelInfo }[];
  created_at: number;
  updated_at: number;
}

interface ModelInfo {
  key: string;
  display_name: string;
  max_context_length?: number;
  architecture?: string;
  format?: string;
  quantization?: { name: string; bits_per_weight: number };
  loaded?: boolean;
  capabilities?: {
    vision?: boolean;
    trained_for_tool_use?: boolean;
    reasoning?: { allowed_options: string[]; default: string };
  };
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
    add: (
      conversationId: string,
      role: string,
      content: string,
      model?: string,
      reasoning?: string,
      inputTokens?: number,
      outputTokens?: number,
      reasoningTokens?: number
    ) => Promise<Message>;
    delete: (conversationId: string) => Promise<void>;
    deleteOne: (id: string) => Promise<void>;
  };
  providers: {
    list: () => Promise<Provider[]>;
    create: (provider: Omit<Provider, 'id' | 'created_at' | 'updated_at'>) => Promise<Provider>;
    update: (id: string, provider: Omit<Provider, 'id' | 'created_at' | 'updated_at'>) => Promise<Provider>;
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
