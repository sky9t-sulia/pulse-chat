/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PACKAGE_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

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
  input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  duration_ms?: number;
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
      reasoningTokens?: number,
      durationMs?: number,
      toolInvocations?: ToolInvocationRecord[] | null
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
  tools: {
    list: () => Promise<Tool[]>;
    create: (tool: Omit<Tool, 'id' | 'created_at' | 'updated_at'>) => Promise<Tool>;
    update: (id: string, tool: Partial<Omit<Tool, 'id' | 'created_at' | 'updated_at'>>) => Promise<void>;
    delete: (id: string) => Promise<void>;
    execute: (toolName: string, toolArgsJson: string) => Promise<ToolResult>;
  };
}

interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
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

declare global {
  interface Window {
    chatApi: ChatAPI;
  }
}

export {};
