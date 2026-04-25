import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CollapsibleContent } from './CollapsibleContent';

export function ReasoningBlock({ reasoning }: { reasoning: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setExpanded((expanded) => !expanded)}
        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
      >
        <span className="text-xs theme-text-muted">Reasoning</span>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 theme-text-muted" />
          : <ChevronDown className="w-3.5 h-3.5 theme-text-muted" />}
      </button>
      {expanded && (
        <CollapsibleContent>{reasoning}</CollapsibleContent>
      )}
    </div>
  );
}
