import { useCallback } from 'react';
import type { Provider, ProviderModel } from '../types/types';

export function useProviders(
  setProviders: React.Dispatch<React.SetStateAction<Provider[]>>,
  activeProvider: Provider | null,
  setActiveProvider: (p: Provider | null) => void,
) {
  const refreshProviders = useCallback(async () => {
    const list = await window.chatApi.providers.list();
    const normalized = list.map((p: Provider) => ({
      ...p,
      models: (p.models ?? []).map((m: ProviderModel) => {
        const info = m.model_info ?? { key: '', display_name: '' };
        const maxCtx = info.max_context_length ?? (m.model_info as unknown as Record<string, unknown>)?.max_context_length as number | undefined;
        return {
          ...m,
          model_info: maxCtx ? { ...info, max_context_length: maxCtx } : info,
        } as ProviderModel;
      }),
    }));
    setProviders(normalized as Provider[]);
    const savedId = localStorage.getItem('active-provider-id');
    if (savedId) {
      const match = normalized.find((p) => p.id === savedId);
      if (match) setActiveProvider(match as Provider);
    }
  }, [setActiveProvider]);

  const addProvider = useCallback(
    async (provider: Omit<Provider, 'id' | 'created_at' | 'updated_at'>) => {
      const newProvider = await window.chatApi.providers.create({
        ...provider,
        api_type: provider.api_type ?? 'openai',
        endpoint: provider.endpoint ?? '/v1/chat/completions',
        models: provider.models ?? [],
      });
      await refreshProviders();
      return newProvider;
    },
    [refreshProviders]
  );

  const updateProvider = useCallback(
    async (id: string, provider: Omit<Provider, 'id' | 'created_at' | 'updated_at'>) => {
      await window.chatApi.providers.update(id, {
        ...provider,
        api_type: provider.api_type ?? 'openai',
        endpoint: provider.endpoint ?? '/v1/chat/completions',
        models: provider.models ?? [],
      });
      await refreshProviders();
    },
    [refreshProviders]
  );

  const deleteProvider = useCallback(
    async (id: string) => {
      await window.chatApi.providers.delete(id);
      await refreshProviders();
      if (activeProvider?.id === id) {
        setActiveProvider(null);
      }
    },
    [refreshProviders, activeProvider, setActiveProvider]
  );

  return { refreshProviders, addProvider, updateProvider, deleteProvider };
}
