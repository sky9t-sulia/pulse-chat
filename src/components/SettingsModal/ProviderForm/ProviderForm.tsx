import { useCallback } from 'react';
import { Eye, EyeOff, Save } from 'lucide-react';
import { joinUrl } from '../../../helpers/url';
import { ThemedInput } from '../../FormInputs';
import { useProviderForm } from '../../../hooks/useProviderForm';
import { buildModelsList } from '../../../helpers/build-models-list';
import type { Provider } from '../../../types/types';
import { ModelPicker } from './ModelPicker';
import { ModelList } from './ModelList';

export function ProviderForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Provider;
  onSave: (provider: Omit<Provider, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
}) {
  const {
    state,
    setApiKey, setDefaultModel, setShowKey, setModelsListExpanded,
    setModelEnabled, setModelOverrides,
    fetchModels, handleUrlChange, handleNameChange, resetModelState,
  } = useProviderForm(initial);

  const { name, apiUrl, apiKey, defaultModel, showKey, availableModels, isFetchingModels, modelFetchError, modelObjectsMap, modelOverrides, modelEnabled, modelsListExpanded } = state;

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const modelsList = buildModelsList(
      availableModels, modelObjectsMap, modelOverrides, modelEnabled, defaultModel
    );

    onSave({
      name,
      api_url: apiUrl,
      api_key: apiKey || initial?.api_key || '',
      api_type: 'openai',
      endpoint: '/v1/chat/completions',
      default_model: defaultModel,
      model_info: null,
      models: modelsList,
    });
  }, [name, apiUrl, apiKey, defaultModel, availableModels, modelObjectsMap, modelOverrides, modelEnabled, initial, onSave]);

  const fullUrl = apiUrl && '/v1/chat/completions' ? joinUrl(apiUrl, '/v1/chat/completions') : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Name</label>
        <ThemedInput
          type="text"
          value={name}
          onChange={handleNameChange}
          placeholder="OpenAI Compatible"
          required
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">API URL</label>
        <ThemedInput
          type="url"
          value={apiUrl}
          onChange={handleUrlChange}
          placeholder="http://localhost:8000"
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
          <ThemedInput
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="pr-10"
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

      <ModelPicker
        defaultModel={defaultModel}
        availableModels={availableModels}
        isFetchingModels={isFetchingModels}
        modelFetchError={modelFetchError}
        apiUrl={apiUrl}
        apiKey={apiKey}
        onModelChange={(val) => {
          setDefaultModel(val);
          resetModelState();
        }}
        onFetch={fetchModels}
      />

      {availableModels.length > 0 && (
        <ModelList
          availableModels={availableModels}
          defaultModel={defaultModel}
          modelObjectsMap={modelObjectsMap}
          modelOverrides={modelOverrides}
          modelEnabled={modelEnabled}
          onToggleEnabled={(key) => setModelEnabled((prev) => ({ ...prev, [key]: !prev[key] }))}
          onSetDefault={setDefaultModel}
          onSetMaxContext={(key, val) => setModelOverrides((prev) => ({
            ...prev,
            [key]: { ...prev[key], max_context: val },
          }))}
          onExpandToggle={() => setModelsListExpanded((v) => !v)}
          expanded={modelsListExpanded}
        />
      )}

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
