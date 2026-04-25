import { Brain } from 'lucide-react';
import type { TokenStats } from '../../hooks/useChat';

interface TokenStatsBarProps {
  tokenStats: TokenStats | null;
  maxTokens: number;
}

export function TokenStatsBar({ tokenStats, maxTokens }: TokenStatsBarProps) {
  const inputTokens = tokenStats?.input_tokens ?? 0;
  const outputTokens = tokenStats?.total_output_tokens ?? 0;
  const reasoningTokens = tokenStats?.reasoning_output_tokens ?? 0;
  const usedTokens = inputTokens + outputTokens;

  if (!maxTokens) return null;

  return (
    <div className="text-xs font-mono flex items-center justify-center gap-3 mb-2">
      <span className="theme-text-muted">
        {usedTokens.toLocaleString()} / {maxTokens.toLocaleString()} tokens
        <span className="theme-text-muted ml-1">
          ({(((maxTokens - usedTokens) / maxTokens) * 100).toFixed(1)}% left)
        </span>
      </span>
      <span className="theme-text-muted">
        ↑ {inputTokens.toLocaleString()} · ↓ {outputTokens.toLocaleString()}
        {reasoningTokens > 0 && (
          <>
            {' · '}
            <Brain className="w-3 h-3 inline-block align-[-1px]" />
            {' '}
            {reasoningTokens.toLocaleString()}
          </>
        )}
      </span>
    </div>
  );
}
