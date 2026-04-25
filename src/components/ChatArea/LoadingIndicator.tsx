import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { LoadingPhase } from '../../hooks/useChat';
import { CollapsibleContent } from './CollapsibleContent';

export function LoadingIndicator({
  phase,
  reasoning,
}: {
  phase: LoadingPhase;
  reasoning?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const labels: Record<string, string> = {
    waiting: 'Thinking',
  };

  const phaseLabel = labels[phase.kind] || 'Thinking';

  const hasReasoning = !!reasoning;

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setExpanded((expanded) => !expanded)}
        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-current theme-text-secondary thinking-dot" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-current theme-text-secondary thinking-dot" style={{ animationDelay: '160ms' }} />
          <span className="w-2 h-2 rounded-full bg-current theme-text-secondary thinking-dot" style={{ animationDelay: '320ms' }} />
        </div>
        <span className="text-xs theme-text-muted">
          {phaseLabel}
        </span>
        {hasReasoning && (
          expanded
            ? <ChevronUp className="w-3.5 h-3.5 theme-text-muted" />
            : <ChevronDown className="w-3.5 h-3.5 theme-text-muted" />
        )}
      </button>
      {hasReasoning && expanded && (
        <CollapsibleContent>{reasoning}</CollapsibleContent>
      )}
    </div>
  );
}
