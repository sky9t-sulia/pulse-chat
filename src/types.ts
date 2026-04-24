export interface Conversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
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
}

export interface ProviderModel {
  key: string;
  display_name?: string;
  model_info?: ModelInfo;
}

export interface Provider {
  id: string;
  name: string;
  api_url: string;
  api_key: string;
  api_type: 'openai' | 'lmstudio';
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
  capabilities?: {
    vision?: boolean;
    trained_for_tool_use?: boolean;
    reasoning?: { allowed_options: string[]; default: string };
  };
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
}
