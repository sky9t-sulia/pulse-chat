import { useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ProviderModel } from '../../types/types';

interface Props {
  availableModels: ProviderModel[];
  displayModelName: string;
  showModelDropdown: boolean;
  onToggle: () => void;
  onSelect: (key: string) => void;
}

export function ModelDropdown({
  availableModels,
  displayModelName,
  showModelDropdown,
  onToggle,
  onSelect,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showModelDropdown) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onToggle();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModelDropdown, onToggle]);

  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        onClick={onToggle}
        className="flex text-xs items-center gap-1 text-xs theme-text-secondary hover-theme-text-primary transition-colors min-w-0"
      >
        <span className="text-gray-500">model:</span>
        <span className="font-mono truncate max-w-[180px]">{displayModelName}</span>
        {showModelDropdown ? (
          <ChevronUp className="w-3 h-3 shrink-0" />
        ) : (
          <ChevronDown className="w-3 h-3 shrink-0" />
        )}
      </button>

      {showModelDropdown && (
        <div className="absolute bottom-full mb-2 left-0 theme-sidebar border theme-border-light rounded-lg shadow-xl py-0 min-w-[220px] max-h-[240px] overflow-y-auto z-20">
          {availableModels.map((modelItem) => (
            <button
              key={modelItem.key}
              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                modelItem.key === displayModelName
                  ? 'theme-sidebar-active theme-text-primary'
                  : 'theme-text-primary hover-theme-sidebar-hover'
              }`}
              onClick={() => onSelect(modelItem.key)}
            >
              <div className="font-medium truncate">{modelItem.display_name || modelItem.key}</div>
              {modelItem.model_info?.max_context_length && (
                <div className="text-gray-500 text-[11px]">
                  {Number(modelItem.model_info.max_context_length).toLocaleString()} tokens
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
