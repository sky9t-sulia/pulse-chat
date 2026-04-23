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
  created_at: number;
  model?: string;
}

export interface Provider {
  id: string;
  name: string;
  api_url: string;
  api_key: string;
  default_model: string;
  created_at: number;
  updated_at: number;
}

export interface ChatSession {
  conversationId: string;
  provider: Provider;
  messages: Message[];
  isStreaming: boolean;
  streamingContent?: string;
}

export type ThemeMode = 'dark' | 'light';
