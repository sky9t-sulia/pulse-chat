import { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Provider } from '../types';
import { X, Plus, Save, Trash2, Eye, EyeOff } from 'lucide-react';

function ProviderForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Provider;
  onSave: (provider: Omit<Provider, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [apiUrl, setApiUrl] = useState(
    initial?.api_url || 'https://api.openai.com/v1/chat/completions'
  );
  const [apiKey, setApiKey] = useState(initial?.api_key || '');
  const [defaultModel, setDefaultModel] = useState(initial?.default_model || 'gpt-4o');
  const [showKey, setShowKey] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      api_url: apiUrl,
      api_key: apiKey || initial?.api_key || '',
      default_model: defaultModel,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="OpenAI"
          className="w-full px-3 py-2 bg-input border border-border-light rounded-lg text-sm text-gray-200 focus:outline-none focus:border-gray-500"
          required
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">API URL</label>
        <input
          type="url"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder="https://api.openai.com/v1/chat/completions"
          className="w-full px-3 py-2 bg-input border border-border-light rounded-lg text-sm text-gray-200 focus:outline-none focus:border-gray-500"
          required
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">API Key</label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full px-3 py-2 pr-10 bg-input border border-border-light rounded-lg text-sm text-gray-200 focus:outline-none focus:border-gray-500"
            required={!initial}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Default Model</label>
        <input
          type="text"
          value={defaultModel}
          onChange={(e) => setDefaultModel(e.target.value)}
          placeholder="gpt-4o"
          className="w-full px-3 py-2 bg-input border border-border-light rounded-lg text-sm text-gray-200 focus:outline-none focus:border-gray-500"
          required
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-1"
        >
          <Save className="w-3.5 h-3.5" />
          {initial ? 'Update' : 'Add'}
        </button>
      </div>
    </form>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const { providers, addProvider, updateProvider, deleteProvider, setActiveProvider } = useApp();
  const [editingProvider, setEditingProvider] = useState<Provider | undefined>();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-gray-100">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Providers section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-300">Providers</h3>
            <button
              onClick={() => {
                setEditingProvider(undefined);
                setShowForm(true);
              }}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add Provider
            </button>
          </div>

          {showForm ? (
            <div className="bg-input border border-border-light rounded-lg p-4 mb-3">
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
                <p className="text-xs text-gray-600 py-4 text-center">
                  No providers configured
                </p>
              )}
              {providers.map((provider, index) => (
                <div
                  key={provider.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-pointer ${
                    index === 0
                      ? 'border-gray-600 bg-sidebar-active'
                      : 'border-border hover:border-border-light'
                  }`}
                  onClick={() => setActiveProvider(provider)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-200 font-medium">
                        {provider.name}
                      </span>
                      {index === 0 && (
                        <span className="text-[10px] bg-green-900 text-green-400 px-1.5 py-0.5 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500 truncate">
                        {provider.default_model}
                      </span>
                      <span className="text-xs text-gray-600">•</span>
                      <span className="text-xs text-gray-500 truncate">
                        {provider.api_url.replace(/https?:\/\//, '')}
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
                      className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProvider(provider.id);
                      }}
                      className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* About */}
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-gray-600">
            Chat App v1.0.0 — A claude.ai-inspired desktop client
          </p>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
