export interface Conversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

export interface ToolInvocationRecord {
  id: string;
  name: string;
  arguments: string;
  status: 'running' | 'done' | 'error';
  result?: string;
  error?: string;
  durationMs?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
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

export interface ProviderModel {
  key: string;
  display_name?: string;
  model_info?: ModelInfo;
  enabled?: boolean;
}

export interface Provider {
  id: string;
  name: string;
  api_url: string;
  api_key: string;
  api_type: 'openai';
  endpoint: string;
  default_model: string;
  model_info: ModelInfo | null;
  models: ProviderModel[];
  created_at: number;
  updated_at: number;
}

export interface ModelInfo {
  key: string;
  display_name: string;
  max_context_length?: number;
  architecture?: string;
  format?: string;
  quantization?: { name: string; bits_per_weight: number };
  loaded?: boolean;
}

export interface ChatSession {
  conversationId: string;
  provider: Provider;
  messages: Message[];
  isStreaming: boolean;
  streamingContent?: string;
}

export type ThemeMode = 'dark' | 'light';

export type ChatFontFamily = 'system' | 'sans' | 'serif' | 'mono' | 'inter';

export interface ChatSettings {
  system_prompt: string;
  font_family: ChatFontFamily;
  font_size: number;
  max_calls_per_tool: number;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
  handler_code: string;
  enabled: boolean;
  is_built_in: boolean; // cannot be deleted, only toggled
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string of arguments
}

export interface ToolResult {
  tool_call_id: string;
  name: string;
  content: string;
  error?: string;
  duration_ms: number;
}

export interface UserSettings {
  id: string | null;
  name: string;
  bio: string;
  gender: string;
  onboardingComplete: boolean;
}

export interface ChatAPI {
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
  user: {
    get: () => Promise<UserSettings>;
    update: (user: { name: string; bio: string; gender: string }) => Promise<void>;
  };
}
