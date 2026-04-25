import { contextBridge, ipcRenderer } from 'electron';

interface Conversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

interface ToolInvocationRecord {
  id: string;
  name: string;
  arguments: string;
  status: 'running' | 'done' | 'error';
  result?: string;
  error?: string;
  durationMs?: number;
}

interface Message {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  reasoning?: string;
  created_at: number;
  model?: string;
  tool_invocations?: ToolInvocationRecord[] | null;
}

interface Provider {
  id: string;
  name: string;
  api_url: string;
  api_key: string;
  api_type: 'openai';
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
}

interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler_code: string;
  enabled: boolean;
  is_built_in: boolean;
  created_at: number;
  updated_at: number;
}

interface ToolResult {
  tool_call_id: string;
  name: string;
  content: string;
  error?: string;
  duration_ms: number;
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
    add: (
      conversationId: string,
      role: string,
      content: string,
      model?: string,
      reasoning?: string,
      inputTokens?: number,
      outputTokens?: number,
      reasoningTokens?: number,
      durationMs?: number,
      toolInvocations?: ToolInvocationRecord[] | null,
    ) =>
      ipcRenderer.invoke(
        'messages:add',
        conversationId,
        role,
        content,
        model,
        reasoning,
        inputTokens,
        outputTokens,
        reasoningTokens,
        durationMs,
        toolInvocations,
      ) as Promise<Message>,
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
  tools: {
    list: () => ipcRenderer.invoke('tools:list') as Promise<Tool[]>,
    create: (tool: Omit<Tool, 'id' | 'created_at' | 'updated_at'>) =>
      ipcRenderer.invoke('tools:create', tool) as Promise<Tool>,
    update: (id: string, tool: Partial<Omit<Tool, 'id' | 'created_at' | 'updated_at'>>) =>
      ipcRenderer.invoke('tools:update', id, tool),
    delete: (id: string) => ipcRenderer.invoke('tools:delete', id),
    execute: (toolName: string, toolArgsJson: string) =>
      ipcRenderer.invoke('tools:execute', toolName, toolArgsJson) as Promise<ToolResult>,
  },
};

contextBridge.exposeInMainWorld('chatApi', chatApi);
