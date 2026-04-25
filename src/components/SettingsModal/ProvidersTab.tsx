import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Pencil, Trash2, Plus } from 'lucide-react';
import type { Provider } from '../../types/types';
import { ProviderForm } from './ProviderForm/ProviderForm';

export function ProvidersTab() {
  const { providers, activeProvider, addProvider, updateProvider, deleteProvider, setActiveProvider } = useApp();
  const [editingProvider, setEditingProvider] = useState<Provider | undefined>();
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium theme-text-primary">
          {showForm ? (editingProvider ? 'Edit Provider' : 'Add Provider') : ''}
        </h3>
        {!showForm && (
          <button
            onClick={() => {
              setEditingProvider(undefined);
              setShowForm(true);
            }}
            className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add Provider
          </button>
        )}
      </div>

      {showForm ? (
        <div className="border theme-border-light rounded-lg p-4 mb-3">
          <ProviderForm
            onSave={(data) => {
              if (editingProvider) {
                updateProvider(editingProvider.id, data);
              } else {
                addProvider(data);
              }
              setShowForm(false);
              setEditingProvider(undefined);
            }}
            onCancel={() => {
              setShowForm(false);
              setEditingProvider(undefined);
            }}
            initial={editingProvider}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {providers.length === 0 && (
            <p className="text-xs theme-text-muted py-4 text-center">
              No providers configured
            </p>
          )}
          {providers.map((provider) => {
            const isActive = provider.id === activeProvider?.id;
            return (
            <div
              key={provider.id}
              className={`flex hover-theme-border-light theme-border items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-pointer ${
                isActive
                  ? 'bg-[color:var(--bg-sidebar)]'
                  : ''
              }`}
              onClick={() => setActiveProvider(provider)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm theme-text-primary font-medium">
                    {provider.name}
                  </span>
                  <span className="text-[10px] theme-sidebar-active theme-text-secondary px-1.5 py-0.5 rounded">
                    OpenAI Compatible
                  </span>
                  {isActive && (
                    <span className="text-[10px] bg-[var(--accent)] text-white px-1.5 py-0.5 rounded">
                      Active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500 truncate">
                    {provider.default_model}
                  </span>
                  <span className="text-xs theme-text-muted">{"\u2022"}</span>
                  <span className="text-xs text-gray-500 truncate">
                    {provider.api_url.replace(/https?:\/\//, '')}
                  </span>
                  <span className="text-xs theme-text-muted">{"\u2022"}</span>
                  <span className="text-xs text-gray-500 truncate font-mono">
                    {provider.endpoint}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingProvider(provider);
                    setShowForm(true);
                  }}
                  className="p-1 theme-text-secondary hover-theme-text-primary transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteProvider(provider.id);
                  }}
                  className="p-1 theme-text-secondary hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
