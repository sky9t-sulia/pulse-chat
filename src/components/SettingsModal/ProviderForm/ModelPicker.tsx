import { Loader2, RefreshCw } from 'lucide-react';
import { ThemedInput } from '../../FormInputs';

interface Props {
  defaultModel: string;
  availableModels: string[];
  isFetchingModels: boolean;
  modelFetchError: string | null;
  apiUrl: string;
  apiKey: string;
  onModelChange: (val: string) => void;
  onFetch: (url: string, key: string) => void;
}

export function ModelPicker({
  defaultModel,
  availableModels,
  isFetchingModels,
  modelFetchError,
  apiUrl,
  apiKey,
  onModelChange,
  onFetch,
}: Props) {
  const showReadOnly = availableModels.length > 0;

  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">Default Model</label>
      <div className="flex gap-2">
        {showReadOnly ? (
          <ThemedInput
            type="text"
            value={defaultModel}
            onChange={(e) => onModelChange(e.target.value)}
            placeholder="Auto-selected from fetched models"
            className="bg-theme-input"
            readOnly
          />
        ) : (
          <ThemedInput
            type="text"
            value={defaultModel}
            onChange={(e) => onModelChange(e.target.value)}
            placeholder="Type a model name"
          />
        )}
        <button
          type="button"
          onClick={() => onFetch(apiUrl, apiKey)}
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
        <p className="text-xs text-red-400 mt-1">Could not fetch models: {modelFetchError}.</p>
      )}
      {availableModels.length === 0 && !isFetchingModels && !modelFetchError && !defaultModel && (
        <p className="text-xs text-gray-500 mt-1">Click "Fetch" to load available models.</p>
      )}
    </div>
  );
}
