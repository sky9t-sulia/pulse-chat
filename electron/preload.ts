import { contextBridge, ipcRenderer } from 'electron';

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

const chatApi = {
  conversations: {
    list: () => ipcRenderer.invoke('conversations:list') as Promise<Conversation[]>,
    create: (title: string) =>
      ipcRenderer.invoke('conversations:create', title) as Promise<Conversation>,
    delete: (id: string) => ipcRenderer.invoke('conversations:delete', id),
    get: (id: string) =>
      ipcRenderer.invoke('conversations:get', id) as Promise<Conversation | undefined>,
    updateTitle: (id: string, title: string) =>
      ipcRenderer.invoke('conversations:updateTitle', id, title),
  },
  messages: {
    get: (conversationId: string) =>
      ipcRenderer.invoke('messages:get', conversationId) as Promise<Message[]>,
    add: (conversationId: string, role: string, content: string, model?: string, reasoning?: string) =>
      ipcRenderer.invoke('messages:add', conversationId, role, content, model, reasoning) as Promise<Message>,
    delete: (conversationId: string) =>
      ipcRenderer.invoke('messages:delete', conversationId),
    deleteOne: (id: string) =>
      ipcRenderer.invoke('messages:deleteOne', id),
  },
  providers: {
    list: () => ipcRenderer.invoke('providers:list') as Promise<Provider[]>,
    create: (provider: Omit<Provider, 'id' | 'created_at' | 'updated_at'>) =>
      ipcRenderer.invoke('providers:create', provider) as Promise<Provider>,
    update: (id: string, provider: Omit<Provider, 'id' | 'created_at' | 'updated_at'>) =>
      ipcRenderer.invoke('providers:update', id, provider),
    delete: (id: string) => ipcRenderer.invoke('providers:delete', id),
    get: (id: string) =>
      ipcRenderer.invoke('providers:get', id) as Promise<Provider | undefined>,
  },
};

contextBridge.exposeInMainWorld('chatApi', chatApi);
