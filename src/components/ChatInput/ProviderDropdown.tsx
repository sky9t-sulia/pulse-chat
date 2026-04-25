import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Provider } from '../../types/types';

interface Props {
  providers: Provider[];
  activeProvider: Provider | null;
  showProviderDropdown: boolean;
  onToggle: () => void;
  onSelect: (p: Provider) => void;
}

export function ProviderDropdown({
  providers,
  activeProvider,
  showProviderDropdown,
  onToggle,
  onSelect,
}: Props) {
  if (!activeProvider) return null;

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-xs theme-text-secondary hover-theme-text-primary transition-colors"
      >
        <span>{activeProvider.name}</span>
        {showProviderDropdown ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>

      {showProviderDropdown && providers.length > 1 && (
        <div className="absolute bottom-full mb-2 left-0 theme-sidebar border theme-border-light rounded-lg shadow-xl py-0 min-w-[200px] z-10">
          {providers.map((providerItem) => (
            <button
              key={providerItem.id}
              className="w-full text-left px-3 py-2 text-xs theme-text-primary hover-theme-sidebar-hover transition-colors"
              onClick={() => onSelect(providerItem)}
            >
              <div className="font-medium">{providerItem.name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
