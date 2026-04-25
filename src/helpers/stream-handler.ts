import type { TokenStats, StreamingCallbacks } from '../types/chat-api';
import type { JsonChunk } from './json-types';
import { parseUsage } from './json-types';

export interface StreamState {
  accumulatedContent: string;
  accumulatedReasoning: string;
  finalStats: TokenStats | null;
  firstContentAt: number | null;
  toolCallsByIndex: Record<number, { id: string; name: string; args: string }>;
  responseIdRef: Record<string, string>;
  streamConvId: string;
  route: (chunk: string, onContent: (s: string) => void, onReasoning: (s: string) => void) => void;
  callbacks: StreamingCallbacks;
}

export function handleJsonChunk(json: JsonChunk, state: StreamState) {
  const { callbacks, route, accumulatedContent, accumulatedReasoning, finalStats, firstContentAt, toolCallsByIndex, responseIdRef, streamConvId } = state;

  let newContent = accumulatedContent;
  let newReasoning = accumulatedReasoning;
  let newStats = finalStats;
  let newFirstContentAt = firstContentAt;
  const newToolCallsByIndex = { ...toolCallsByIndex };

  switch (json.type) {
    case 'response.created':
      if (json.id) responseIdRef[streamConvId] = json.id;
      break;
    case 'response.output_text.delta':
      if (json.text) {
        newContent += json.text;
        if (newFirstContentAt === null) newFirstContentAt = Date.now();
        callbacks.onContent(newContent);
      }
      break;
    case 'response.completed':
      if (json.stats) {
        newStats = json.stats;
        callbacks.onStats(newStats);
      }
      break;
    case 'response.finish':
      if (json.result?.output) {
        for (const item of json.result.output) {
          if (item.type === 'message' && item.content) {
            newContent = item.content;
            if (newFirstContentAt === null) newFirstContentAt = Date.now();
            callbacks.onContent(newContent);
          }
        }
      }
      if (json.result?.stats) {
        newStats = json.result.stats;
        callbacks.onStats(newStats);
      } else if (json.stats) {
        newStats = json.stats;
        callbacks.onStats(newStats);
      }
      if (json.result?.response_id) {
        responseIdRef[streamConvId] = json.result.response_id;
      } else if (json.result?.id) {
        responseIdRef[streamConvId] = json.result.id;
      }
      break;
    default: {
      const delta = json.choices?.[0]?.delta;
      if (delta?.content) {
        callbacks.onPhase({ kind: 'streaming' });
        if (newFirstContentAt === null) newFirstContentAt = Date.now();
        route(
          delta.content,
          (chunk) => { newContent += chunk; callbacks.onContent(newContent); },
          (chunk) => { newReasoning += chunk; callbacks.onReasoning(newReasoning); },
        );
      }
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = typeof tc.index === 'number' ? tc.index : 0;
          const entry = newToolCallsByIndex[idx] || { id: '', name: '', args: '' };
          if (tc.id) entry.id = tc.id;
          if (tc.function?.name) entry.name += tc.function.name;
          if (tc.function?.arguments) entry.args += tc.function.arguments;
          newToolCallsByIndex[idx] = entry;
        }
        callbacks.onPhase({ kind: 'streaming' });
      }
      let reasoningChunk = '';
      if (typeof delta?.reasoning === 'string') {
        reasoningChunk = delta.reasoning;
      } else if (typeof delta?.reasoning?.content === 'string') {
        reasoningChunk = delta.reasoning.content;
      } else if (typeof delta?.reasoning_content === 'string') {
        reasoningChunk = delta.reasoning_content;
      } else if (typeof delta?.thinking === 'string') {
        reasoningChunk = delta.thinking;
      } else if (typeof delta?.thought === 'string') {
        reasoningChunk = delta.thought;
      }
      if (reasoningChunk) {
        callbacks.onPhase({ kind: 'streaming' });
        newReasoning += reasoningChunk;
        callbacks.onReasoning(newReasoning);
      }
      if (json.usage) {
        newStats = parseUsage(json);
        callbacks.onStats(newStats);
      }
      break;
    }
  }

  return { accumulatedContent: newContent, accumulatedReasoning: newReasoning, finalStats: newStats, firstContentAt: newFirstContentAt, toolCallsByIndex: newToolCallsByIndex };
}
