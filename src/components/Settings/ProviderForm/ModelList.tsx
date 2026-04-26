import { Check, Heart, ChevronDown, ChevronUp } from 'lucide-react';
import { strategies } from '../../../context/providers';
import { ThemedInput } from '../../FormInputs';

interface Props {
  availableModels: string[];
  defaultModel: string;
  modelObjectsMap: Record<string, unknown>;
  modelOverrides: Record<string, { max_context?: number }>;
  modelEnabled: Record<string, boolean>;
  onToggleEnabled: (key: string) => void;
  onSetDefault: (key: string) => void;
  onSetMaxContext: (key: string, val: number | undefined) => void;
  onExpandToggle: () => void;
  expanded: boolean;
}

export function ModelList({
  availableModels,
  defaultModel,
  modelObjectsMap,
  modelOverrides,
  modelEnabled,
  onToggleEnabled,
  onSetDefault,
  onSetMaxContext,
  onExpandToggle,
  expanded,
}: Props) {
  const strategy = strategies.openai;

  return (
    <div className="mt-3 border theme-border-light rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onExpandToggle}
        className="w-full px-3 py-2 theme-input flex items-center justify-between text-xs theme-text-secondary hover-theme-text-primary transition-colors"
      >
        <span className="flex items-center gap-2">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span className="theme-text-primary font-medium">
            {availableModels.length} model{availableModels.length !== 1 ? 's' : ''}
          </span>
          <span className="theme-text-muted">
            · {availableModels.filter((model) => modelEnabled[model] !== false).length} enabled
          </span>
        </span>
      </button>

      {expanded && (
        <div className="max-h-80 overflow-y-auto border-t theme-border-light divide-y divide-(--bg-border-light)">
          {availableModels.map((modelKey) => {
            const modelObj = modelObjectsMap[modelKey] as Record<string, unknown> | undefined;
            const info = modelObj ? strategy?.extractModelInfo(modelObj) : null;
            const override = modelOverrides[modelKey];
            const isEnabled = modelEnabled[modelKey] !== false;
            const isDefault = modelKey === defaultModel;

            return (
              <ModelRow
                key={modelKey}
                modelKey={modelKey}
                info={info}
                override={override}
                isEnabled={isEnabled}
                isDefault={isDefault}
                onToggleEnabled={onToggleEnabled}
                onSetDefault={onSetDefault}
                onSetMaxContext={onSetMaxContext}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModelRow({
  modelKey,
  info,
  override,
  isEnabled,
  isDefault,
  onToggleEnabled,
  onSetDefault,
  onSetMaxContext,
}: {
  modelKey: string;
  info: ReturnType<typeof strategies.openai.extractModelInfo> | null;
  override: { max_context?: number } | undefined;
  isEnabled: boolean;
  isDefault: boolean;
  onToggleEnabled: (key: string) => void;
  onSetDefault: (key: string) => void;
  onSetMaxContext: (key: string, val: number | undefined) => void;
}) {
  return (
    <div className={`px-3 py-2.5 transition-colors ${isDefault ? 'bg-(--accent)/5' : ''}`}>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => onToggleEnabled(modelKey)}
          className={`w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0 ${
            isEnabled
              ? 'border-(--accent) bg-(--accent)'
              : 'border-(--bg-border-light) hover:border-(--text-muted)'
          }`}
          title={isEnabled ? 'Disable model' : 'Enable model'}
        >
          {isEnabled && <Check className="w-3 h-3 text-white" />}
        </button>

        <span
          className={`text-xs font-mono flex-1 truncated ${
            isEnabled ? 'theme-text-primary' : 'theme-text-muted line-through'
          }`}
          title={modelKey}
        >
          {modelKey}
        </span>

        {isEnabled && (
          <ThemedInput
            type="number"
            value={override?.max_context ?? (info?.max_context_length ?? '')}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : undefined;
              onSetMaxContext(modelKey, val);
            }}
            placeholder="ctx"
            className="font-mono theme-text-primary focus:border-(--accent) w-20! py-0! text-xs text-center appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            rounded="sm"
            title="Max context length (tokens)"
          />
        )}

        <button
          type="button"
          onClick={() => onSetDefault(modelKey)}
          disabled={!isEnabled}
          className={`flex items-center justify-center shrink-0 transition-opacity ${
            isEnabled ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-30'
          }`}
          title={isDefault ? 'Default model' : 'Set as default'}
        >
          {isDefault ? (
            <Heart className="w-4 h-4 text-(--accent) fill-(--accent)" />
          ) : (
            <Heart className="w-4 h-4 theme-text-muted" />
          )}
        </button>
      </div>
    </div>
  );
}
