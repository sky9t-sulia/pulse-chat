import { Pencil, Trash2 } from 'lucide-react';
import type { Provider } from '../../types/types';
import { SectionLabel } from './SectionLabel';

interface ProvidersTabProps {
  providers: Provider[];
  activeProvider: Provider | null;
  onEdit: (provider: Provider) => void;
  onDelete: (id: string) => void;
  onSelect: (provider: Provider) => void;
}

export function ProvidersTab({ providers, activeProvider, onEdit, onDelete, onSelect }: ProvidersTabProps) {
  return (
    <>
      <div className="flex items-center gap-1.5 mb-1">
        <SectionLabel>OpenAI-Compatible</SectionLabel>
      </div>
      {providers.length === 0 && (
        <p className="text-xs theme-text-muted py-4 text-center">
          No providers configured
        </p>
      )}
      {providers.map((provider) => (
        <div
          key={provider.id}
          className={`flex items-center justify-between p-3 mb-2 rounded-lg border transition-colors cursor-pointer ${
            activeProvider?.id === provider.id
              ? 'theme-sidebar-active theme-border'
              : 'theme-border-light hover-theme-border'
          }`}
          onClick={() => onSelect(provider)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium theme-text-primary truncate">{provider.name}</h4>
              {activeProvider?.id === provider.id && (
                <span className="text-[10px] text-(--active-text) bg-(--accent) bg-opacity-20 px-1.5 py-0.5 rounded">
                  Active
                </span>
              )}
            </div>
            <p className="text-xs theme-text-muted truncate mt-0.5">{provider.api_url}</p>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(provider); }}
              className="p-1 theme-text-secondary hover-theme-text-primary transition-colors rounded"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(provider.id); }}
              className="p-1 theme-text-secondary hover-theme-text-primary transition-colors rounded"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
