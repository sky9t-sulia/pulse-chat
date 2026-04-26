import { Save } from 'lucide-react';
import { ThemedInput, ThemedTextarea } from '../FormInputs';

interface Props {
  name: string;
  description: string;
  parameters: string;
  handlerCode: string;
  paramError?: string | null;
  readOnly?: boolean;
  onChangeName?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onChangeDescription?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onChangeParameters?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onChangeHandlerCode?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit?: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitLabel?: string;
}

export function ToolsTabForm({
  name,
  description,
  parameters,
  handlerCode,
  paramError,
  readOnly,
  onChangeName,
  onChangeDescription,
  onChangeParameters,
  onChangeHandlerCode,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
}: Props) {
  const inputClass = readOnly ? 'bg-theme-input cursor-not-allowed' : '';

  return (
    <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Name</label>
          <ThemedInput
            type="text"
            value={name}
            onChange={onChangeName}
            placeholder="my_tool"
            className={`font-mono ${inputClass}`}
            required={!readOnly}
            readOnly={readOnly}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Description</label>
          <ThemedTextarea
            value={description}
            onChange={onChangeDescription}
            placeholder="What this tool does..."
            rows={2}
            className={`resize-none ${inputClass}`}
            required={!readOnly}
            readOnly={readOnly}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Parameters (JSON Schema)</label>
          <ThemedTextarea
            value={parameters}
            onChange={onChangeParameters}
            placeholder={`{\n  "type": "object",\n  "properties": {\n    "query": { "type": "string", "description": "Search query" }\n  },\n  "required": ["query"]\n}\n\nUse {"type": "object", "properties": {}} for no parameters.`}
            rows={10}
            className={`text-xs resize-y font-mono resize-none ${inputClass}`}
            required={!readOnly}
            readOnly={readOnly}
          />
          {paramError && <p className="text-xs text-red-400 mt-1">{paramError}</p>}
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Handler Code <span className="theme-text-muted">(optional — JS function)</span>
          </label>
          <ThemedTextarea
            value={handlerCode}
            onChange={onChangeHandlerCode}
            placeholder={`// This code runs as the function body — 'args' is available.\n// You can define helper functions at the top level.\n\nfunction formatISO(d) {\n  return d.toISOString();\n}\n\nreturn JSON.stringify({ date: formatISO(new Date()) });`}
            rows={10}
            className={`text-xs resize-y font-mono resize-none ${inputClass}`}
            readOnly={readOnly}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm theme-text-secondary hover-theme-text-primary transition-colors"
          >
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly && onSubmit && (
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-(--accent) hover:bg-(--accent-hover) text-white rounded-lg transition-colors flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              {submitLabel}
            </button>
          )}
        </div>
      </form>
  );
}
