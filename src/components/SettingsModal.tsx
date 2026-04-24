import { useState, useEffect, useCallback } from 'react';
import {
  useApp,
  LMSTUDIO_ENDPOINTS,
  CHAT_FONT_STACKS,
  CHAT_FONT_SIZE_STEPS,
} from '../context/AppContext';
import { strategies } from '../context/providers';
import type { Provider, ModelInfo, ChatFontFamily } from '../types';
import { X, Plus, Save, Trash2, Eye, EyeOff, Loader2, Pencil } from 'lucide-react';

const FONT_FAMILY_OPTIONS: { value: ChatFontFamily; label: string }[] = [
  { value: 'system', label: 'System Default' },
  { value: 'sans', label: 'Sans Serif' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Monospace' },
  { value: 'inter', label: 'Inter' },
];

const API_TYPE_OPTIONS: { value: 'openai' | 'lmstudio'; label: string }[] = [
  { value: 'openai', label: 'OpenAI Compatible' },
  { value: 'lmstudio', label: 'LM Studio' },
];

const ENDPOINT_LABELS: Record<string, string> = {
  '/api/v1/chat': 'Native Chat (/api/v1/chat)',
  '/v1/responses': 'Responses API (/v1/responses)',
  '/v1/chat/completions': 'Chat Completions (/v1/chat/completions)',
  '/v1/messages': 'Messages API (/v1/messages)',
};

function ProviderForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Provider;
  onSave: (provider: Omit<Provider, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
}) {
  const isEditing = !!initial;

  const [name, setName] = useState(initial?.name || 'LM Studio');
  const [apiUrl, setApiUrl] = useState(
    initial?.api_url || 'http://localhost:1234'
  );
  const [apiKey, setApiKey] = useState(initial?.api_key || '');
  const [apiType, setApiType] = useState<Provider['api_type']>(
    initial?.api_type ?? 'lmstudio'
  );
  const [endpoint, setEndpoint] = useState(
    initial?.endpoint ?? '/api/v1/chat'
  );
  const [defaultModel, setDefaultModel] = useState(initial?.default_model || '');
  const [showKey, setShowKey] = useState(false);

  // Current strategy based on apiType
  const strategy = apiType === 'lmstudio' ? strategies.lmstudio : strategies.openai;

  // Model auto-fetch state
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelFetchError, setModelFetchError] = useState<string | null>(null);
  const [fetchedAtStartup, setFetchedAtStartup] = useState(initial ? false : false);
  const [selectedModelInfo, setSelectedModelInfo] = useState<ModelInfo | null>(null);
  const [modelObjectsMap, setModelObjectsMap] = useState<Record<string, unknown>>({});

  // Manual overrides for optional model info fields
  const [overrideMaxContext, setOverrideMaxContext] = useState<string>(
    initial?.model_info?.max_context_length?.toString() ?? ''
  );

  // Build final model_info: auto-fetched values merged with manual overrides
  const builtModelInfo: ModelInfo | null = selectedModelInfo
    ? {
        ...selectedModelInfo,
        max_context_length: overrideMaxContext
          ? Number(overrideMaxContext)
          : selectedModelInfo.max_context_length,
      }
    : null;

  // Extract model info when model selection changes (from already-fetched data)
  useEffect(() => {
    if (!defaultModel || !strategy) return;
    const modelObj = modelObjectsMap[defaultModel] as Record<string, unknown> | undefined;
    if (modelObj) {
      setSelectedModelInfo(strategy.extractModelInfo(modelObj));
    } else {
      setSelectedModelInfo(null);
    }
  }, [defaultModel, modelObjectsMap, strategy]);

  const getBaseUrl = (url: string) => {
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.host}`;
    } catch {
      return url.replace(/\/+$/, '');
    }
  };

  const fetchModels = useCallback(async (url: string, key: string) => {
    setIsFetchingModels(true);
    setModelFetchError(null);
    try {
      const baseUrl = getBaseUrl(url);
      const headers: Record<string, string> = key ? { Authorization: `Bearer ${key}` } : {};
      const endpoint = strategy.getModelEndpoint(baseUrl);

      const res = await fetch(endpoint, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const { models, modelObjects } = strategy.parseModelList(json);

      setModelObjectsMap(modelObjects);
      setAvailableModels(models);
      if (models.length > 0 && !defaultModel) {
        setDefaultModel(models[0]);
      }
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch models';
      setModelFetchError(msg);
      setAvailableModels([]);
    } finally {
      setIsFetchingModels(false);
    }
  }, [apiType, defaultModel]);

  // Auto-fetch models when URL or API key changes
  useEffect(() => {
    if (!fetchedAtStartup) return;
    if (!apiUrl) { setAvailableModels([]); return; }
    fetchModels(apiUrl, apiKey);
  }, [apiUrl, apiKey, apiType, fetchModels, fetchedAtStartup]);

  // Detect when user starts editing an existing provider
  useEffect(() => {
    if (!initial) return;
    setFetchedAtStartup(false);
    const check = setTimeout(() => {
      if (name !== initial.name || apiUrl !== initial.api_url || apiType !== initial.api_type || endpoint !== initial.endpoint) {
        setFetchedAtStartup(true);
        setDefaultModel('');
        setAvailableModels([]);
        setModelFetchError(null);
      }
    }, 100);
    return () => clearTimeout(check);
  }, [initial, name, apiUrl, apiType, endpoint]);

  // Initial fetch when loading an existing provider
  useEffect(() => {
    if (initial && apiUrl && !fetchedAtStartup) {
      const timer = setTimeout(() => {
        setFetchedAtStartup(true);
        fetchModels(apiUrl, apiKey);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [initial, apiUrl, apiKey, fetchModels, fetchedAtStartup]);

  // Reset overrides when model selection changes
  useEffect(() => {
    if (!defaultModel) {
      setOverrideMaxContext('');
    }
  }, [defaultModel]);

  // Restore models when editing an existing provider with models
  useEffect(() => {
    if (!initial?.models || initial.models.length === 0) return;
    const keys = initial.models.map((m) => m.key);
    setAvailableModels(keys);
    // Rebuild modelObjectsMap from initial models
    const map: Record<string, unknown> = {};
    initial.models.forEach((m) => {
      map[m.key] = { key: m.key, display_name: m.display_name, model_info: m.model_info };
    });
    setModelObjectsMap(map);
    if (initial.default_model && keys.includes(initial.default_model)) {
      setDefaultModel(initial.default_model);
    }
    setFetchedAtStartup(true);
  }, [initial]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiUrl(e.target.value);
    if (isEditing) {
      setFetchedAtStartup(false);
      setDefaultModel('');
      setAvailableModels([]);
      setModelObjectsMap({});
      setModelFetchError(null);
      setOverrideMaxContext('');
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (isEditing) {
      setFetchedAtStartup(false);
      setDefaultModel('');
      setAvailableModels([]);
      setModelObjectsMap({});
      setModelFetchError(null);
      setOverrideMaxContext('');
    }
  };

  const handleApiTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as Provider['api_type'];
    setApiType(newType);
    // Set default endpoint for the selected API type
    if (newType === 'lmstudio') {
      setEndpoint('/api/v1/chat');
    } else {
      setEndpoint('/v1/chat/completions');
    }
    if (isEditing) {
      setFetchedAtStartup(false);
      setDefaultModel('');
      setAvailableModels([]);
      setModelObjectsMap({});
      setModelFetchError(null);
      setOverrideMaxContext('');
    }
  };

  const handleEndpointChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setEndpoint(e.target.value);
    if (isEditing) {
      setFetchedAtStartup(false);
      setDefaultModel('');
      setAvailableModels([]);
      setModelObjectsMap({});
      setModelFetchError(null);
      setOverrideMaxContext('');
    }
  };

  const handleManualModelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDefaultModel(e.target.value);
    setAvailableModels([]);
    setModelObjectsMap({});
    setOverrideMaxContext('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Build models list from fetched data
    const modelsList: { key: string; display_name?: string; model_info?: ModelInfo }[] =
      availableModels.map((key) => {
        const obj = modelObjectsMap[key] as Record<string, unknown> | undefined;
        const info = obj ? strategy?.extractModelInfo(obj) : null;
        return {
          key,
          display_name: info?.display_name || key,
          model_info: info || undefined,
        };
      });

    // Add manually-typed model if not already in the list
    if (defaultModel && !modelsList.some((m) => m.key === defaultModel)) {
      modelsList.unshift({
        key: defaultModel,
        display_name: defaultModel,
        model_info: builtModelInfo || undefined,
      });
    }

    onSave({
      name,
      api_url: apiUrl,
      api_key: apiKey || initial?.api_key || '',
      api_type: apiType,
      endpoint,
      default_model: defaultModel,
      model_info: builtModelInfo,
      models: modelsList,
    });
  };

  const fullUrl = apiUrl && endpoint ? `${apiUrl.replace(/\/+$/, '')}${endpoint}` : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={handleNameChange}
          placeholder="LM Studio"
          className="w-full px-3 py-2 theme-input border theme-border-light rounded-lg text-sm theme-text-primary focus:outline-none focus:border-gray-500"
          required
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">API Type</label>
        <select
          value={apiType}
          onChange={handleApiTypeChange}
          className="w-full px-3 py-2 theme-input border theme-border-light rounded-lg text-sm theme-text-primary focus:outline-none focus:border-gray-500 bg-theme-input"
        >
          {API_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {apiType === 'lmstudio' && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">Endpoint</label>
          <select
            value={endpoint}
            onChange={handleEndpointChange}
            className="w-full px-3 py-2 theme-input border theme-border-light rounded-lg text-sm theme-text-primary focus:outline-none focus:border-gray-500 bg-theme-input"
          >
            {LMSTUDIO_ENDPOINTS.map((ep) => (
              <option key={ep} value={ep}>{ENDPOINT_LABELS[ep] || ep}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs text-gray-400 mb-1">API URL</label>
        <input
          type="url"
          value={apiUrl}
          onChange={handleUrlChange}
          placeholder="http://localhost:1234"
          className="w-full px-3 py-2 theme-input border theme-border-light rounded-lg text-sm theme-text-primary focus:outline-none focus:border-gray-500"
          required
        />
      </div>

      {fullUrl && (
        <div className="text-xs text-gray-500 px-1">
          Full URL: <span className="theme-text-secondary font-mono">{fullUrl}</span>
        </div>
      )}

      <div>
        <label className="block text-xs text-gray-400 mb-1">API Key</label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full px-3 py-2 pr-10 theme-input border theme-border-light rounded-lg text-sm theme-text-primary focus:outline-none focus:border-gray-500"
            required={!initial}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 theme-text-secondary hover-theme-text-primary"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Default Model</label>
        {availableModels.length > 0 ? (
          <select
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            className="w-full px-3 py-2 theme-input border theme-border-light rounded-lg text-sm theme-text-primary focus:outline-none focus:border-gray-500 bg-theme-input"
            required
          >
            {availableModels.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={defaultModel}
              onChange={handleManualModelChange}
              placeholder="Select or type a model"
              className="flex-1 px-3 py-2 theme-input border theme-border-light rounded-lg text-sm theme-text-primary focus:outline-none focus:border-gray-500"
              list="models-datalist"
              required
            />
            <button
              type="button"
              onClick={() => fetchModels(apiUrl, apiKey)}
              disabled={isFetchingModels || !apiUrl}
              className="px-3 py-2 theme-input border theme-border-light rounded-lg text-sm theme-text-secondary hover-theme-text-primary transition-colors disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5"
              title="Fetch available models from provider"
            >
              {isFetchingModels ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              {isFetchingModels ? 'Fetching...' : 'Fetch'}
            </button>
          </div>
        )}
        <datalist id="models-datalist">
          {availableModels.map((model) => (
            <option key={model} value={model} />
          ))}
        </datalist>
        {modelFetchError && (
          <p className="text-xs text-red-400 mt-1">Could not fetch models: {modelFetchError}. Type a model name manually.</p>
        )}
        {availableModels.length === 0 && !isFetchingModels && !modelFetchError && !defaultModel && (
          <p className="text-xs text-gray-500 mt-1">Click "Fetch" to load available models, or type a model name manually.</p>
        )}
        {selectedModelInfo && (
          <div className="mt-2 p-2 bg-gray-800/50 rounded text-xs space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20">Model:</span>
              <span className="theme-text-primary">{selectedModelInfo.display_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20">Max context:</span>
              <input
                type="number"
                value={overrideMaxContext || (selectedModelInfo.max_context_length?.toString() ?? '')}
                onChange={(e) => setOverrideMaxContext(e.target.value)}
                placeholder="auto-detected"
                className="w-28 px-2 py-0.5 theme-input border theme-border-light rounded text-xs theme-text-primary focus:outline-none focus:border-gray-500"
              />
              <span className="text-gray-600">tokens</span>
            </div>
            {selectedModelInfo.capabilities && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-20">Caps:</span>
                <span className="theme-text-primary">
                  {[
                    selectedModelInfo.capabilities.vision && 'vision',
                    selectedModelInfo.capabilities.trained_for_tool_use && 'tools',
                    selectedModelInfo.capabilities.reasoning && 'reasoning',
                  ].filter(Boolean).join(', ') || 'basic'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm theme-text-secondary hover-theme-text-primary transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors flex items-center gap-1"
        >
          <Save className="w-3.5 h-3.5" />
          {initial ? 'Update' : 'Add'}
        </button>
      </div>
    </form>
  );
}

function ProvidersTab() {
  const { providers, activeProvider, addProvider, updateProvider, deleteProvider, setActiveProvider } = useApp();
  const [editingProvider, setEditingProvider] = useState<Provider | undefined>();
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium theme-text-primary">Providers</h3>
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
      </div>

      {showForm ? (
        <div className="theme-input border theme-border-light rounded-lg p-4 mb-3">
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-pointer ${
                isActive
                  ? 'border-gray-600 theme-sidebar-active'
                  : 'theme-border hover-theme-border-light'
              }`}
              onClick={() => setActiveProvider(provider)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm theme-text-primary font-medium">
                    {provider.name}
                  </span>
                  <span className="text-[10px] theme-sidebar-active theme-text-secondary px-1.5 py-0.5 rounded">
                    {provider.api_type === 'lmstudio' ? 'LM Studio' : 'OpenAI'}
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
                  <span className="text-xs theme-text-muted">•</span>
                  <span className="text-xs text-gray-500 truncate">
                    {provider.api_url.replace(/https?:\/\//, '')}
                  </span>
                  <span className="text-xs theme-text-muted">•</span>
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

function ChatTab() {
  const { chatSettings, setChatSettings } = useApp();
  const minStep = 0;
  const maxStep = CHAT_FONT_SIZE_STEPS.length - 1;
  const currentStep = Math.max(
    0,
    (CHAT_FONT_SIZE_STEPS as readonly number[]).indexOf(chatSettings.font_size)
  );

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs text-gray-400 mb-1">System Prompt</label>
        <textarea
          value={chatSettings.system_prompt}
          onChange={(e) => setChatSettings({ ...chatSettings, system_prompt: e.target.value })}
          placeholder="Optional — sent as the system message on every request."
          rows={5}
          className="w-full px-3 py-2 theme-input border theme-border-light rounded-lg text-sm theme-text-primary focus:outline-none focus:border-gray-500 resize-y"
        />
        <p className="text-xs theme-text-muted mt-1">
          Applied to new messages in every conversation.
        </p>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Font</label>
        <select
          value={chatSettings.font_family}
          onChange={(e) =>
            setChatSettings({
              ...chatSettings,
              font_family: e.target.value as ChatFontFamily,
            })
          }
          className="w-full px-3 py-2 theme-input border theme-border-light rounded-lg text-sm theme-text-primary focus:outline-none focus:border-gray-500 bg-theme-input"
        >
          {FONT_FAMILY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p
          className="text-xs theme-text-muted mt-2"
          style={{ fontFamily: CHAT_FONT_STACKS[chatSettings.font_family] }}
        >
          The quick brown fox jumps over the lazy dog.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs text-gray-400">Font Size</label>
          <span className="text-xs theme-text-secondary font-mono">
            {chatSettings.font_size}px
          </span>
        </div>
        <input
          type="range"
          min={minStep}
          max={maxStep}
          step={1}
          value={currentStep}
          onChange={(e) =>
            setChatSettings({
              ...chatSettings,
              font_size: CHAT_FONT_SIZE_STEPS[Number(e.target.value)],
            })
          }
          className="w-full accent-gray-500"
        />
        <div className="flex justify-between text-[10px] theme-text-muted mt-1 font-mono">
          {CHAT_FONT_SIZE_STEPS.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'providers' | 'chat'>('providers');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium theme-text-heading">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 theme-text-secondary hover-theme-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-1 mb-5 border-b theme-border">
          <button
            onClick={() => setTab('providers')}
            className={`px-3 py-2 text-sm transition-colors border-b-2 -mb-px ${
              tab === 'providers'
                ? 'theme-text-primary border-gray-400'
                : 'theme-text-secondary border-transparent hover-theme-text-primary'
            }`}
          >
            Providers
          </button>
          <button
            onClick={() => setTab('chat')}
            className={`px-3 py-2 text-sm transition-colors border-b-2 -mb-px ${
              tab === 'chat'
                ? 'theme-text-primary border-gray-400'
                : 'theme-text-secondary border-transparent hover-theme-text-primary'
            }`}
          >
            Chat
          </button>
        </div>

        {tab === 'providers' ? <ProvidersTab /> : <ChatTab />}

        <div className="pt-4 mt-6 border-t theme-border">
          <p className="text-xs theme-text-muted">
            Chat App v1.0.0 — A claude.ai-inspired desktop client
          </p>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
