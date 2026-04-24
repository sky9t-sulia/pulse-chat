import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  useApp,
  LMSTUDIO_ENDPOINTS,
  CHAT_FONT_STACKS,
  CHAT_FONT_SIZE_STEPS,
} from '../context/AppContext';
import { strategies } from '../context/providers';
import type { Provider, ModelInfo, ChatFontFamily } from '../types';
import { X, Plus, Save, Trash2, Eye, EyeOff, Loader2, Pencil, ChevronDown, ChevronUp, Check, RefreshCw, Heart } from 'lucide-react';

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

  // Current strategy based on apiType (stable reference)
  const strategy = useMemo(
    () => (apiType === 'lmstudio' ? strategies.lmstudio : strategies.openai),
    [apiType],
  );

  // Model auto-fetch state
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelFetchError, setModelFetchError] = useState<string | null>(null);
  const [fetchedAtStartup, setFetchedAtStartup] = useState(false);
  const [modelObjectsMap, setModelObjectsMap] = useState<Record<string, unknown>>({});

  // Per-model overrides: { [modelKey]: { max_context?: number } }
  const [modelOverrides, setModelOverrides] = useState<Record<string, { max_context?: number }>>({});
  // Which fetched models are enabled (default all true)
  const [modelEnabled, setModelEnabled] = useState<Record<string, boolean>>({});
  // Whether the fetched model list panel is expanded
  const [modelsListExpanded, setModelsListExpanded] = useState(false);

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
      // Preserve existing enabled state for models that still exist; enable new ones by default
      setModelEnabled((prev) => {
        const next: Record<string, boolean> = {};
        models.forEach((m) => {
          if (prev[m] !== undefined) next[m] = prev[m];
          else next[m] = true;
        });
        return next;
      });
      // Preserve existing overrides for models that still exist; clear for removed ones
      setModelOverrides((prev) => {
        const next: Record<string, { max_context?: number }> = {};
        models.forEach((m) => {
          if (prev[m]) next[m] = prev[m];
        });
        return next;
      });
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
    // For existing providers, skip auto-fetch — models are restored from initial.models
    // For new providers, allow auto-fetch when user changes URL/API key
    if (isEditing) return;
    if (!fetchedAtStartup) return;
    if (!apiUrl) { setAvailableModels([]); return; }
    fetchModels(apiUrl, apiKey);
  }, [apiUrl, apiKey, apiType, fetchModels, fetchedAtStartup, isEditing]);

  // Detect when user starts editing an existing provider
  useEffect(() => {
    if (!initial) return;
    setFetchedAtStartup(false);
    const check = setTimeout(() => {
      if (apiUrl !== initial.api_url || apiType !== initial.api_type || endpoint !== initial.endpoint) {
        setFetchedAtStartup(true);
        setDefaultModel('');
        setAvailableModels([]);
        setModelFetchError(null);
      }
    }, 100);
    return () => clearTimeout(check);
  }, [initial, apiUrl, apiType, endpoint]);

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
    // Restore enabled state and per-model overrides
    const enabled: Record<string, boolean> = {};
    const overrides: Record<string, { max_context?: number }> = {};
    initial.models.forEach((m) => {
      enabled[m.key] = m.enabled !== false;
      if (m.model_info?.max_context_length !== undefined) {
        overrides[m.key] = { max_context: m.model_info.max_context_length };
      }
    });
    setModelEnabled(enabled);
    setModelOverrides(overrides);
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
      setModelOverrides({});
      setModelEnabled({});
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
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
      setModelOverrides({});
      setModelEnabled({});
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
      setModelOverrides({});
      setModelEnabled({});
    }
  };

  const handleManualModelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDefaultModel(e.target.value);
    setAvailableModels([]);
    setModelObjectsMap({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Build models list from fetched data — all models with their enabled state
    const modelsList: { key: string; display_name?: string; model_info?: ModelInfo; enabled?: boolean }[] =
      availableModels
        .map((key) => {
          const obj = modelObjectsMap[key] as Record<string, unknown> | undefined;
          const info = obj ? strategy?.extractModelInfo(obj) : null;
          const override = modelOverrides[key];
          const isEnabled = modelEnabled[key] !== false;
          const displayName = info?.display_name || key;

          // Always include model_info if there's an override, even if API data is missing
          if (override?.max_context !== undefined) {
            return {
              key,
              display_name: displayName,
              model_info: {
                key,
                display_name: displayName,
                max_context_length: override.max_context,
              },
              enabled: isEnabled,
            };
          }

          if (info) {
            return {
              key,
              display_name: displayName,
              model_info: {
                ...info,
                max_context_length: info.max_context_length,
              },
              enabled: isEnabled,
            };
          }

          return { key, display_name: displayName, enabled: isEnabled };
        });

    // Add manually-typed model if not already in the list
    if (defaultModel && !modelsList.some((m) => m.key === defaultModel)) {
      const override = modelOverrides[defaultModel];
      const obj = modelObjectsMap[defaultModel] as Record<string, unknown> | undefined;
      const info = obj ? strategy?.extractModelInfo(obj) : null;
      const displayName = info?.display_name || defaultModel;

      if (override?.max_context !== undefined) {
        modelsList.unshift({
          key: defaultModel,
          display_name: displayName,
          model_info: {
            key: defaultModel,
            display_name: displayName,
            max_context_length: override.max_context,
          },
          enabled: true,
        });
      } else if (info) {
        modelsList.unshift({
          key: defaultModel,
          display_name: displayName,
          model_info: { ...info, max_context_length: info.max_context_length },
          enabled: true,
        });
      } else {
        modelsList.unshift({ key: defaultModel, display_name: displayName, enabled: true });
      }
    }

    onSave({
      name,
      api_url: apiUrl,
      api_key: apiKey || initial?.api_key || '',
      api_type: apiType,
      endpoint,
      default_model: defaultModel,
      model_info: null,
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
        <div className="flex gap-2">
          {availableModels.length > 0 ? (
            <input
              type="text"
              value={defaultModel}
              onChange={handleManualModelChange}
              placeholder="Auto-selected from fetched models"
              className="flex-1 px-3 py-2 theme-input border theme-border-light rounded-lg text-sm theme-text-primary focus:outline-none focus:border-gray-500 bg-theme-input"
              readOnly
            />
          ) : (
            <input
              type="text"
              value={defaultModel}
              onChange={handleManualModelChange}
              placeholder="Type a model name"
              className="flex-1 px-3 py-2 theme-input border theme-border-light rounded-lg text-sm theme-text-primary focus:outline-none focus:border-gray-500"
            />
          )}
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
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {isFetchingModels ? 'Fetching...' : 'Fetch'}
          </button>
        </div>
        {modelFetchError && (
          <p className="text-xs text-red-400 mt-1">Could not fetch models: {modelFetchError}. Type a model name manually.</p>
        )}
        {availableModels.length === 0 && !isFetchingModels && !modelFetchError && !defaultModel && (
          <p className="text-xs text-gray-500 mt-1">Click "Fetch" to load available models, or type a model name manually.</p>
        )}

        {/* Fetched models list */}
        {availableModels.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setModelsListExpanded(!modelsListExpanded)}
              className="text-xs theme-text-secondary hover-theme-text-primary flex items-center gap-1 transition-colors"
            >
              {modelsListExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {availableModels.length} model{availableModels.length !== 1 ? 's' : ''} fetched
              <span className="theme-text-muted">
                ({availableModels.filter((m) => modelEnabled[m] !== false).length} enabled)
              </span>
            </button>

            {modelsListExpanded && (
              <div className="mt-2 space-y-2 max-h-80 overflow-y-auto pr-1">
                {availableModels.map((modelKey) => {
                  const modelObj = modelObjectsMap[modelKey] as Record<string, unknown> | undefined;
                  const info = modelObj ? strategy?.extractModelInfo(modelObj) : null;
                  const override = modelOverrides[modelKey];
                  const isEnabled = modelEnabled[modelKey] !== false;
                  const isDefault = modelKey === defaultModel;

                  return (
                    <div
                      key={modelKey}
                      className={`border rounded-lg p-2.5 transition-colors ${
                        isDefault
                          ? 'border-[var(--accent)]/50 bg-[var(--accent)]/5'
                          : 'border-gray-700 bg-gray-900/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {/* Default model heart */}
                        <button
                          type="button"
                          onClick={() => setDefaultModel(modelKey)}
                          disabled={!isEnabled}
                          className={`flex items-center justify-center flex-shrink-0 transition-colors ${
                            isEnabled ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-40'
                          }`}
                          title="Set as default model"
                        >
                          {isDefault ? (
                            <Heart className="w-4 h-4 text-[var(--accent)] fill-[var(--accent)]" />
                          ) : (
                            <Heart className="w-4 h-4 theme-text-muted" />
                          )}
                        </button>
                        {/* Enable/disable checkbox */}
                        <button
                          type="button"
                          onClick={() => setModelEnabled((prev) => ({
                            ...prev,
                            [modelKey]: !isEnabled,
                          }))}
                          className={`w-4 h-4 rounded flex items-center justify-center border transition-colors flex-shrink-0 ${
                            isEnabled
                              ? 'border-[var(--accent)] bg-[var(--accent)]'
                              : 'border-gray-600 hover:border-gray-500'
                          }`}
                        >
                          {isEnabled && <Check className="w-3 h-3 text-white" />}
                        </button>
                        <span className={`text-xs font-mono flex-1 truncate ${isEnabled ? 'theme-text-primary' : 'theme-text-muted line-through'}`}>
                          {modelKey}
                        </span>
                      </div>

                      {isEnabled && (
                        <div className="mt-2 ml-6 flex flex-wrap gap-3">
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] text-gray-500 w-16 flex-shrink-0">Max ctx:</label>
                            <input
                              type="number"
                              value={override?.max_context ?? (info?.max_context_length ?? '')}
                              onChange={(e) => {
                                const val = e.target.value ? Number(e.target.value) : undefined;
                                setModelOverrides((prev) => ({
                                  ...prev,
                                  [modelKey]: { ...prev[modelKey], max_context: val },
                                }));
                              }}
                              placeholder="auto"
                              className="w-24 px-1.5 py-0.5 theme-input border theme-border-light rounded text-xs theme-text-primary focus:outline-none focus:border-gray-500"
                            />
                          </div>
                          {info?.capabilities && (
                            <div className="flex items-center gap-1">
                              <label className="text-[10px] text-gray-500 w-16 flex-shrink-0">Caps:</label>
                              <span className="text-[10px] theme-text-secondary">
                                {[
                                  info.capabilities.vision && 'vision',
                                  info.capabilities.trained_for_tool_use && 'tools',
                                  info.capabilities.reasoning && 'reasoning',
                                ].filter(Boolean).join(', ') || 'basic'}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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
            Chat App v{import.meta.env.PACKAGE_VERSION || '1.0.0'} — Local first LLM desktop client
          </p>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
