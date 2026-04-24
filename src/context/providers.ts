import type { ModelInfo } from '../types';

export interface ParsedModelList {
  models: string[];
  modelObjects: Record<string, unknown>;
}

export interface ProviderStrategy {
  type: 'openai' | 'lmstudio';
  getModelEndpoint: (baseUrl: string) => string;
  parseModelList: (json: unknown) => ParsedModelList;
  extractModelInfo: (modelObj: Record<string, unknown>) => ModelInfo | null;
}

const openaiStrategy: ProviderStrategy = {
  type: 'openai',
  getModelEndpoint: (baseUrl: string) => `${baseUrl}/v1/models`,
  parseModelList: (json: unknown) => {
    const data = json as Record<string, unknown>;
    const dataArray = data.data as Record<string, unknown>[] | undefined;
    const models = dataArray?.map((m) => m.id as string).filter(Boolean) || [];
    const modelObjects = Object.fromEntries(
      dataArray?.map((m) => [m.id, m]) ?? []
    ) as Record<string, unknown>;
    return { models, modelObjects };
  },
  extractModelInfo: (modelObj) => {
    const id = modelObj.id as string;
    const info: ModelInfo = {
      key: id,
      display_name: (modelObj.name as string) || id,
    };
    // OpenAI API uses "context_length", normalize to max_context_length
    const ctx = (modelObj.context_length as number) ?? (modelObj.max_context_length as number);
    if (ctx) info.max_context_length = ctx;
    if (modelObj.format) info.format = modelObj.format as string;
    return info;
  },
};

const lmstudioStrategy: ProviderStrategy = {
  type: 'lmstudio',
  getModelEndpoint: (baseUrl: string) => `${baseUrl}/api/v1/models`,
  parseModelList: (json: unknown) => {
    const data = json as Record<string, unknown>;
    const modelsArray = data.models as Record<string, unknown>[] | undefined;
    const models = modelsArray?.map((m) => m.key as string).filter(Boolean) || [];
    const modelObjects = Object.fromEntries(
      modelsArray?.map((m) => [m.key, m]) ?? []
    ) as Record<string, unknown>;
    return { models, modelObjects };
  },
  extractModelInfo: (modelObj) => {
    // Prefer loaded instance's config context_length, then max_context_length, then default
    const loaded = modelObj.loaded_instances as { config: { context_length: number } }[] | undefined;
    const ctxFromLoaded = loaded?.[0]?.config?.context_length;
    const ctxFromMeta = modelObj.max_context_length as number | undefined;
    const maxContext = ctxFromLoaded ?? ctxFromMeta ?? 32768; // 32k default

    const info: ModelInfo = {
      key: modelObj.key as string,
      display_name: modelObj.display_name as string,
      max_context_length: maxContext,
    };
    if (modelObj.architecture) info.architecture = modelObj.architecture as string;
    if (modelObj.format) info.format = modelObj.format as string;
    if (modelObj.quantization) info.quantization = modelObj.quantization as { name: string; bits_per_weight: number };
    if ((modelObj.loaded_instances as unknown[] | undefined)?.length) {
      info.loaded = true;
    }
    if (modelObj.capabilities) {
      info.capabilities = modelObj.capabilities as {
        vision?: boolean;
        trained_for_tool_use?: boolean;
        reasoning?: { allowed_options: string[]; default: string };
      };
    }
    return info;
  },
};

export const strategies: Record<string, ProviderStrategy> = {
  openai: openaiStrategy,
  lmstudio: lmstudioStrategy,
};
