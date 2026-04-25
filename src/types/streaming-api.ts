export type LoadingPhase =
  | { kind: 'idle' }
  | { kind: 'waiting' }
  | { kind: 'streaming' };

export interface TokenStats {
  input_tokens: number;
  total_output_tokens: number;
  reasoning_output_tokens: number;
  tokens_per_second?: number;
}

export interface ToolInvocation {
  id: string;
  name: string;
  arguments: string;
  status: 'running' | 'done' | 'error';
  result?: string;
  error?: string;
  durationMs?: number;
}

export interface ApiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ApiMessage {
  role: string;
  content: string | null;
  tool_calls?: ApiToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface StreamingCallbacks {
  onContent: (content: string) => void;
  onReasoning: (reasoning: string) => void;
  onStats: (stats: TokenStats | null) => void;
  onPhase: (phase: LoadingPhase) => void;
  onError: (errorMessage: string) => void;
}
