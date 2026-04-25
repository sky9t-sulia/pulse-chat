import type { ProviderModel } from '../types/types';
import { strategies } from '../context/providers';

function extractInfo(obj: Record<string, unknown> | undefined) {
  return obj ? strategies.openai?.extractModelInfo(obj) : null;
}

export function buildModelsList(
  availableModels: string[],
  modelObjectsMap: Record<string, unknown>,
  modelOverrides: Record<string, { max_context?: number }>,
  modelEnabled: Record<string, boolean>,
  defaultModel: string,
): ProviderModel[] {
  const modelsList: ProviderModel[] = availableModels
    .map((key) => {
      const info = extractInfo(modelObjectsMap[key] as Record<string, unknown> | undefined);
      const override = modelOverrides[key];
      const isEnabled = modelEnabled[key] !== false;
      const displayName = info?.display_name || key;

      if (override?.max_context !== undefined) {
        return {
          key,
          display_name: displayName,
          model_info: { key, display_name: displayName, max_context_length: override.max_context },
          enabled: isEnabled,
        };
      }

      if (info) {
        return {
          key,
          display_name: displayName,
          model_info: { ...info, max_context_length: info.max_context_length },
          enabled: isEnabled,
        };
      }

      return { key, display_name: displayName, enabled: isEnabled };
    });

  if (defaultModel && !modelsList.some((m) => m.key === defaultModel)) {
    const override = modelOverrides[defaultModel];
    const info = extractInfo(modelObjectsMap[defaultModel] as Record<string, unknown> | undefined);
    const displayName = info?.display_name || defaultModel;

    if (override?.max_context !== undefined) {
      modelsList.unshift({
        key: defaultModel,
        display_name: displayName,
        model_info: { key: defaultModel, display_name: displayName, max_context_length: override.max_context },
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

  return modelsList;
}
