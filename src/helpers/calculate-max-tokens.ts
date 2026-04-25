export function calculateMaxTokens(
  availableModels: Array<{ key: string; model_info?: { max_context_length?: number } }>,
  displayModelName: string,
  activeProviderModelInfo: { max_context_length?: number } | null,
): number {
  const selectedModelInfo = availableModels.find((model) => model.key === displayModelName)?.model_info;
  return selectedModelInfo?.max_context_length
    ? Number(selectedModelInfo.max_context_length)
    : activeProviderModelInfo?.max_context_length
      ? Number(activeProviderModelInfo.max_context_length)
      : 32768;
}
