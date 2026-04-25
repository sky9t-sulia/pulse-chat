import { useCallback, useEffect, useState } from 'react';
import type { Provider } from '../types/types';
import { getBaseUrl } from '../helpers/url';
import { strategies } from '../context/providers';

export interface ModelState {
  availableModels: string[];
  isFetchingModels: boolean;
  modelFetchError: string | null;
  modelObjectsMap: Record<string, unknown>;
  modelOverrides: Record<string, { max_context?: number }>;
  modelEnabled: Record<string, boolean>;
  defaultModel: string;
  modelsListExpanded: boolean;
  showKey: boolean;
}

export interface ProviderFormState {
  name: string;
  apiUrl: string;
  apiKey: string;
  endpoint: string;
}

export interface UseProviderFormResult {
  state: ProviderFormState & ModelState;
  setName: (n: string) => void;
  setApiUrl: (u: string) => void;
  setApiKey: (k: string) => void;
  setDefaultModel: (m: string) => void;
  setShowKey: (s: boolean) => void;
  setModelEnabled: (fn: React.SetStateAction<Record<string, boolean>>) => void;
  setModelOverrides: (fn: React.SetStateAction<Record<string, { max_context?: number }>>) => void;
  setModelsListExpanded: (fn: React.SetStateAction<boolean>) => void;
  fetchModels: (url: string, key: string) => void;
  handleUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  resetModelState: () => void;
}

export function useProviderForm(initial?: Provider): UseProviderFormResult {
  const [name, setName] = useState(initial?.name || 'OpenAI Compatible');
  const [apiUrl, setApiUrl] = useState(initial?.api_url || 'http://localhost:8000');
  const [apiKey, setApiKey] = useState(initial?.api_key || '');
  const [endpoint] = useState(initial?.endpoint ?? '/v1/chat/completions');
  const [defaultModel, setDefaultModel] = useState(initial?.default_model || '');
  const [showKey, setShowKey] = useState(false);

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelFetchError, setModelFetchError] = useState<string | null>(null);
  const [modelObjectsMap, setModelObjectsMap] = useState<Record<string, unknown>>({});
  const [modelOverrides, setModelOverrides] = useState<Record<string, { max_context?: number }>>({});
  const [modelEnabled, setModelEnabled] = useState<Record<string, boolean>>({});
  const [modelsListExpanded, setModelsListExpanded] = useState(false);

  const fetchModels = useCallback(async (url: string, key: string) => {
    setIsFetchingModels(true);
    setModelFetchError(null);
    try {
      const baseUrl = getBaseUrl(url);
      const headers: Record<string, string> = key ? { Authorization: `Bearer ${key}` } : {};
      const modelEndpoint = strategies.openai.getModelEndpoint(baseUrl);

      const res = await fetch(modelEndpoint, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const { models, modelObjects } = strategies.openai.parseModelList(json);

      setModelObjectsMap(modelObjects);
      setAvailableModels(models);
      setModelEnabled((prev) => {
        const next: Record<string, boolean> = {};
        models.forEach((m) => {
          if (prev[m] !== undefined) next[m] = prev[m];
          else next[m] = true;
        });
        return next;
      });
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch models';
      setModelFetchError(msg);
      setAvailableModels([]);
    } finally {
      setIsFetchingModels(false);
    }
  }, [defaultModel]);

  useEffect(() => {
    if (!initial?.models || initial.models.length === 0) return;

    const keys = initial.models.map((m) => m.key);
    setAvailableModels(keys);
    const map: Record<string, unknown> = {};
    initial.models.forEach((m) => {
      map[m.key] = { key: m.key, display_name: m.display_name, model_info: m.model_info };
    });
    setModelObjectsMap(map);
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
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const resetModelState = useCallback(() => {
    setDefaultModel('');
    setAvailableModels([]);
    setModelObjectsMap({});
    setModelFetchError(null);
    setModelOverrides({});
    setModelEnabled({});
  }, []);

  return {
    state: { name, apiUrl, apiKey, endpoint, defaultModel, showKey, availableModels, isFetchingModels, modelFetchError, modelObjectsMap, modelOverrides, modelEnabled, modelsListExpanded },
    setName, setApiUrl, setApiKey, setDefaultModel, setShowKey,
    setModelEnabled, setModelOverrides, setModelsListExpanded,
    fetchModels, handleUrlChange, handleNameChange, resetModelState,
  };
}
