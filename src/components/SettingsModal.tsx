import { useState, useEffect, useCallback } from 'react';
import {
  useApp,
  CHAT_FONT_STACKS,
  CHAT_FONT_SIZE_STEPS,
} from '../context/AppContext';
import { useToolRegistry } from '../context/tools';
import { strategies } from '../context/providers';
import type { Provider, ModelInfo, ChatFontFamily, Tool } from '../types';
import { X, Plus, Save, Trash2, Eye, EyeOff, Loader2, Pencil, ChevronDown, ChevronUp, Check, RefreshCw, Heart, Wrench } from 'lucide-react';

const FONT_FAMILY_OPTIONS: { value: ChatFontFamily; label: string }[] = [
  { value: 'system', label: 'System Default' },
  { value: 'sans', label: 'Inter (Sans)' },
  { value: 'serif', label: 'Noto Serif' },
  { value: 'mono', label: 'JetBrains Mono' },
];

function ProviderForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Provider;
  onSave: (provider: Omit<Provider, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name || 'OpenAI');
  const [apiUrl, setApiUrl] = useState(
    initial?.api_url || 'https://api.openai.com'
  );
  const [apiKey, setApiKey] = useState(initial?.api_key || '');
  const [endpoint] = useState(
    initial?.endpoint ?? '/v1/chat/completions'
  );
  const [defaultModel, setDefaultModel] = useState(initial?.default_model || '');
  const [showKey, setShowKey] = useState(false);

  const strategy = strategies.openai;

  // Model auto-fetch state
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelFetchError, setModelFetchError] = useState<string | null>(null);
  const [modelObjectsMap, setModelObjectsMap] = useState<Record<string, unknown>>({});
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
  }, [defaultModel]);

  // Auto-fetch models when URL or API key changes
  useEffect(() => {
    if (!apiUrl) { setAvailableModels([]); return; }
    fetchModels(apiUrl, apiKey);
  }, [apiUrl, apiKey, fetchModels]);

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
  }, [initial]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiUrl(e.target.value);
    setDefaultModel('');
    setAvailableModels([]);
    setModelObjectsMap({});
    setModelFetchError(null);
    setModelOverrides({});
    setModelEnabled({});
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
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
      api_type: 'openai',
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
          placeholder="OpenAI"
          className="w-full px-3 py-2 theme-input border theme-border-light rounded-lg text-sm theme-text-primary focus:outline-none focus:border-gray-500"
          required
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">API URL</label>
        <input
          type="url"
          value={apiUrl}
          onChange={handleUrlChange}
          placeholder="https://api.openai.com"
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
          <div className="mt-3 border theme-border-light rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setModelsListExpanded(!modelsListExpanded)}
              className="w-full px-3 py-2 theme-input flex items-center justify-between text-xs theme-text-secondary hover-theme-text-primary transition-colors"
            >
              <span className="flex items-center gap-2">
                {modelsListExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span className="theme-text-primary font-medium">
                  {availableModels.length} model{availableModels.length !== 1 ? 's' : ''}
                </span>
                <span className="theme-text-muted">
                  · {availableModels.filter((m) => modelEnabled[m] !== false).length} enabled
                </span>
              </span>
            </button>

            {modelsListExpanded && (
              <div className="max-h-80 overflow-y-auto border-t theme-border-light divide-y divide-[color:var(--bg-border-light)]">
                {availableModels.map((modelKey) => {
                  const modelObj = modelObjectsMap[modelKey] as Record<string, unknown> | undefined;
                  const info = modelObj ? strategy?.extractModelInfo(modelObj) : null;
                  const override = modelOverrides[modelKey];
                  const isEnabled = modelEnabled[modelKey] !== false;
                  const isDefault = modelKey === defaultModel;
                  const caps = info?.capabilities
                    ? [
                        info.capabilities.vision && 'vision',
                        info.capabilities.trained_for_tool_use && 'tools',
                        info.capabilities.reasoning && 'reasoning',
                      ].filter(Boolean) as string[]
                    : [];

                  return (
                    <div
                      key={modelKey}
                      className={`px-3 py-2.5 transition-colors ${
                        isDefault ? 'bg-[var(--accent)]/5' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
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
                              : 'border-[color:var(--bg-border-light)] hover:border-[color:var(--text-muted)]'
                          }`}
                          title={isEnabled ? 'Disable model' : 'Enable model'}
                        >
                          {isEnabled && <Check className="w-3 h-3 text-white" />}
                        </button>

                        {/* Model name */}
                        <span
                          className={`text-xs font-mono flex-1 truncate ${
                            isEnabled ? 'theme-text-primary' : 'theme-text-muted line-through'
                          }`}
                          title={modelKey}
                        >
                          {modelKey}
                        </span>

                        {/* Capability chips */}
                        {isEnabled && caps.length > 0 && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {caps.map((c) => (
                              <span
                                key={c}
                                className="text-[10px] px-1.5 py-0.5 rounded theme-input theme-text-secondary border theme-border-light"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Max context input */}
                        {isEnabled && (
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
                            placeholder="ctx"
                            className="w-20 px-2 py-1 theme-input border theme-border-light rounded text-[11px] font-mono theme-text-primary focus:outline-none focus:border-[color:var(--accent)] flex-shrink-0"
                            title="Max context length (tokens)"
                          />
                        )}

                        {/* Default model heart */}
                        <button
                          type="button"
                          onClick={() => setDefaultModel(modelKey)}
                          disabled={!isEnabled}
                          className={`flex items-center justify-center flex-shrink-0 transition-opacity ${
                            isEnabled ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-30'
                          }`}
                          title={isDefault ? 'Default model' : 'Set as default'}
                        >
                          {isDefault ? (
                            <Heart className="w-4 h-4 text-[var(--accent)] fill-[var(--accent)]" />
                          ) : (
                            <Heart className="w-4 h-4 theme-text-muted" />
                          )}
                        </button>
                      </div>
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
        <h3 className="text-sm font-medium theme-text-primary">
          {showForm ? (editingProvider ? 'Edit Provider' : 'Add Provider') : 'Providers'}
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
                    OpenAI
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

function ToolsTab() {
  const { tools, enabledTools, updateTool, addTool, deleteTool } = useToolRegistry();
  const [showForm, setShowForm] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parameters, setParameters] = useState('{}');
  const [paramError, setParamError] = useState<string | null>(null);

  const openEdit = (tool: Tool) => {
    setEditingTool(tool);
    setName(tool.name);
    setDescription(tool.description);
    setParameters(JSON.stringify(tool.parameters, null, 2));
    setShowForm(true);
  };

  const openNew = () => {
    setEditingTool(null);
    setName('');
    setDescription('');
    setParameters('{}');
    setParamError(null);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingTool(null);
    setParamError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setParamError(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(parameters);
    } catch {
      setParamError('Invalid JSON in parameters');
      return;
    }

    if (editingTool) {
      updateTool(editingTool.id, { name, description, parameters: parsed as Record<string, unknown> });
    } else {
      addTool({ name, description, parameters: parsed as Record<string, unknown>, enabled: true, is_built_in: false });
    }
    cancelForm();
  };

  const handleToggle = async (tool: Tool) => {
    await updateTool(tool.id, { enabled: !tool.enabled });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium theme-text-primary">
          {showForm ? (editingTool ? 'Edit Tool' : 'Add Tool') : 'Tools'}
        </h3>
        {!showForm && (
          <button
            onClick={openNew}
            className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add Tool
          </button>
        )}
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-3 theme-input border theme-border-light rounded-lg p-4 mb-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my_tool"
              className="w-full px-3 py-2 theme-input border theme-border-light rounded-lg text-sm theme-text-primary focus:outline-none focus:border-gray-500 font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this tool does..."
              rows={2}
              className="w-full px-3 py-2 theme-input border theme-border-light rounded-lg text-sm theme-text-primary focus:outline-none focus:border-gray-500 resize-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Parameters (JSON Schema)
            </label>
            <textarea
              value={parameters}
              onChange={(e) => { setParameters(e.target.value); setParamError(null); }}
              placeholder={`{\n  "type": "object",\n  "properties": {\n    "query": { "type": "string", "description": "Search query" }\n  },\n  "required": ["query"]\n}`}
              rows={6}
              className="w-full px-3 py-2 theme-input border theme-border-light rounded-lg text-xs theme-text-primary focus:outline-none focus:border-gray-500 font-mono resize-none"
              required
            />
            {paramError && <p className="text-xs text-red-400 mt-1">{paramError}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cancelForm}
              className="px-4 py-2 text-sm theme-text-secondary hover-theme-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              {editingTool ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      ) : null}

      <div className="space-y-2">
        {tools.length === 0 ? (
          <p className="text-xs theme-text-muted text-center py-4">No tools configured.</p>
        ) : (
          tools.map((tool) => (
            <div
              key={tool.id}
              className={`flex items-center gap-3 px-3 py-2.5 theme-input border theme-border-light rounded-lg transition-colors ${
                !tool.enabled ? 'opacity-50' : ''
              }`}
            >
              <Wrench className="w-4 h-4 theme-text-muted flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono theme-text-primary">{tool.name}</span>
                  {tool.is_built_in && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded theme-input theme-text-muted border theme-border-light">
                      built-in
                    </span>
                  )}
                </div>
                <p className="text-xs theme-text-muted truncate mt-0.5">{tool.description}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => handleToggle(tool)}
                  className={`w-8 h-4 rounded-full transition-colors relative ${
                    tool.enabled ? 'bg-[var(--accent)]' : 'theme-input border theme-border-light'
                  }`}
                  title={tool.enabled ? 'Disable' : 'Enable'}
                >
                  <div
                    className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${
                      tool.enabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                {!tool.is_built_in && (
                  <>
                    <button
                      onClick={() => openEdit(tool)}
                      className="p-1 theme-text-secondary hover-theme-text-primary transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => deleteTool(tool.id)}
                      className="p-1 theme-text-secondary hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {enabledTools.length > 0 && (
        <p className="text-xs theme-text-muted mt-3 text-center">
          {enabledTools.length} tool{enabledTools.length !== 1 ? 's' : ''} enabled — available to your model during chat.
        </p>
      )}
    </div>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'providers' | 'tools' | 'chat'>('providers');

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
            onClick={() => setTab('tools')}
            className={`px-3 py-2 text-sm transition-colors border-b-2 -mb-px ${
              tab === 'tools'
                ? 'theme-text-primary border-gray-400'
                : 'theme-text-secondary border-transparent hover-theme-text-primary'
            }`}
          >
            Tools
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

        {tab === 'providers' ? <ProvidersTab /> : tab === 'tools' ? <ToolsTab /> : <ChatTab />}

        <div className="pt-4 mt-6 border-t theme-border">
          <p className="text-xs theme-text-muted">
            {import.meta.env.PACKAGE_NAME} v{import.meta.env.PACKAGE_VERSION || '1.0.0'} — Local-first LLM desktop client
          </p>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
