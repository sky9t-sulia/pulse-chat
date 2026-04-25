import type { LoadingPhase, TokenStats, ToolInvocation, StreamingCallbacks } from '../types/streaming-api';

export function buildStreamingCallbacks(streamingState: {
  setStreamingContent: (content: string) => void;
  setStreamingReasoningContent: (reasoning: string) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setLoadingPhase: (phase: LoadingPhase) => void;
  setTokenStats: (stats: TokenStats | null) => void;
  setToolInvocations: (invocations: ToolInvocation[]) => void;
}): StreamingCallbacks {
  const { setStreamingContent, setStreamingReasoningContent, setIsStreaming, setLoadingPhase, setTokenStats } = streamingState;

  return {
    onContent: (content) => { setStreamingContent(content); },
    onReasoning: (reasoning) => { setStreamingReasoningContent(reasoning); },
    onStats: (stats) => { setTokenStats(stats); },
    onPhase: (phase) => { setLoadingPhase(phase); },
    onError: (errorMessage) => {
      setStreamingContent(errorMessage);
      setIsStreaming(false);
      setLoadingPhase({ kind: 'idle' });
    },
  };
}
