import type { ModelInfo } from '../types';

export interface ParsedModelList {
  models: string[];
  modelObjects: Record<string, unknown>;
}

export interface ProviderStrategy {
  type: 'openai';
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

export const strategies: Record<string, ProviderStrategy> = {
  openai: openaiStrategy,
};
