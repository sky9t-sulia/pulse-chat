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
    add: (conversationId: string, role: string, content: string, model?: string) =>
      ipcRenderer.invoke('messages:add', conversationId, role, content, model) as Promise<Message>,
    delete: (conversationId: string) =>
      ipcRenderer.invoke('messages:delete', conversationId),
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
