import type { LoadingPhase, TokenStats, ToolInvocation, StreamingCallbacks } from '../types/chat-api';

export function buildStreamingCallbacks(streamingState: {
  setStreamingContent: (s: string) => void;
  setStreamingReasoningContent: (s: string) => void;
  setIsStreaming: (v: boolean) => void;
  setLoadingPhase: (p: LoadingPhase) => void;
  setTokenStats: (s: TokenStats | null) => void;
  setToolInvocations: (inv: ToolInvocation[]) => void;
}): StreamingCallbacks {
  const { setStreamingContent, setStreamingReasoningContent, setIsStreaming, setLoadingPhase, setTokenStats } = streamingState;

  return {
    onContent: (s) => { setStreamingContent(s); },
    onReasoning: (s) => { setStreamingReasoningContent(s); },
    onStats: (s) => { setTokenStats(s); },
    onPhase: (p) => { setLoadingPhase(p); },
    onError: (s) => {
      setStreamingContent(s);
      setIsStreaming(false);
      setLoadingPhase({ kind: 'idle' });
    },
  };
}
