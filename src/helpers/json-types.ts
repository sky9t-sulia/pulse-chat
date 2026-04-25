import type { TokenStats } from '../types/streaming-api';

export interface JsonDelta {
  content?: string;
  tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>;
  reasoning?: string | { content?: string };
  reasoning_content?: string;
  thinking?: string;
  thought?: string;
}

export interface JsonUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  completion_tokens_details?: { reasoning_tokens?: number };
}

export interface JsonMessageOutput {
  type?: string;
  content?: string;
}

export interface JsonResult {
  output?: JsonMessageOutput[];
  stats?: TokenStats;
  response_id?: string;
  id?: string;
}

export interface JsonChunk {
  type?: string;
  id?: string;
  text?: string;
  stats?: TokenStats;
  result?: JsonResult;
  choices?: Array<{ delta?: JsonDelta }>;
  usage?: JsonUsage;
}

export function parseUsage(json: JsonChunk): TokenStats | null {
  const usage = json.usage;
  if (!usage) return null;
  return {
    input_tokens: usage.prompt_tokens ?? 0,
    total_output_tokens: usage.completion_tokens ?? 0,
    reasoning_output_tokens: usage.completion_tokens_details?.reasoning_tokens ?? 0,
  };
}
