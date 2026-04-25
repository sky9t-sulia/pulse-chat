import { useState } from 'react';
import { Wrench, Eye, Pencil, Trash2, GripVertical } from 'lucide-react';
import type { Tool } from '../../types/types';
import { ToolsTabForm } from './ToolsTabForm';

interface InlineToolItemProps {
  tool: Tool;
  index: number;
  isDragged: boolean;
  isDropTarget: boolean;
  isCustom: boolean;
  setDragItem: (v: number | null) => void;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: (data: Partial<Omit<Tool, 'id' | 'created_at' | 'updated_at'>>) => void;
  onModeChange: (active: boolean) => void;
}

export function InlineToolItem({
  tool, index, isDragged, isDropTarget, isCustom,
  setDragItem, onToggle, onDelete, onUpdate, onModeChange,
}: InlineToolItemProps) {
  const [mode, setMode] = useState<'row' | 'edit' | 'view'>('row');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parameters, setParameters] = useState('');
  const [handlerCode, setHandlerCode] = useState('');
  const [paramError, setParamError] = useState<string | null>(null);

  const changeMode = (next: 'row' | 'edit' | 'view') => {
    const wasActive = mode !== 'row';
    const willBeActive = next !== 'row';
    if (wasActive !== willBeActive) onModeChange(willBeActive);
    setMode(next);
  };

  const startEdit = () => {
    setName(tool.name);
    setDescription(tool.description);
    setParameters(JSON.stringify(tool.parameters, null, 2));
    setHandlerCode(tool.handler_code || '');
    setParamError(null);
    changeMode('edit');
  };

  const cancel = () => {
    changeMode('row');
    setParamError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setParamError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(parameters);
    } catch {
      setParamError('Invalid JSON in parameters');
      return;
    }
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      (parsed as Record<string, unknown>).type = (parsed as Record<string, unknown>).type || 'object';
    } else {
      setParamError('Parameters must be a JSON object with type: "object"');
      return;
    }
    onUpdate({ name, description, parameters: parsed as Record<string, unknown>, handler_code: handlerCode });
    changeMode('row');
  };

  const isView = mode === 'view';

  if (mode !== 'row') {
    return (
      <ToolsTabForm
        title={isView ? tool.name : 'Edit Tool'}
        name={isView ? tool.name : name}
        description={isView ? tool.description : description}
        parameters={isView ? JSON.stringify(tool.parameters, null, 2) : parameters}
        handlerCode={isView ? (tool.handler_code || '') : handlerCode}
        paramError={paramError}
        readOnly={isView}
        onChangeName={(e) => setName(e.target.value)}
        onChangeDescription={(e) => setDescription(e.target.value)}
        onChangeParameters={(e) => { setParameters(e.target.value); setParamError(null); }}
        onChangeHandlerCode={(e) => setHandlerCode(e.target.value)}
        onSubmit={isView ? undefined : handleSubmit}
        onCancel={cancel}
        submitLabel="Update"
      />
    );
  }

  return (
    <>
      {isDropTarget && !isDragged && (
        <div className="h-0.5 -my-1 mx-2 rounded bg-[var(--accent)] transition-opacity" />
      )}
      <div
        draggable={isCustom}
        onDragStart={() => isCustom && setDragItem(index)}
        onDragEnd={() => isCustom && setDragItem(null)}
        className={`flex items-center gap-3 px-3 py-2.5 border theme-border-light rounded-lg transition-colors ${
          isDragged ? 'opacity-40' : ''
        } ${isDropTarget && isDragged ? 'border-[var(--accent)]' : ''}
        } ${!tool.enabled ? 'opacity-50' : ''}`}
      >
        <GripVertical className={`w-4 h-4 flex-shrink-0 cursor-grab active:cursor-grabbing ${isCustom ? 'theme-text-muted/40' : 'hidden'}`} />
        <Wrench className="w-4 h-4 theme-text-muted flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono theme-text-primary">{tool.name}</span>
            {tool.is_built_in && (
              <span className="text-[10px] px-1.5 py-0.5 rounded theme-input theme-text-muted border theme-border-light">
                built-in
              </span>
            )}
          </div>
          <p className="text-xs theme-text-muted mt-0.5">{tool.description}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {tool.is_built_in ? (
            <>
              <button
                type="button"
                role="switch"
                aria-checked={tool.enabled}
                onClick={onToggle}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                  tool.enabled ? 'bg-[var(--accent)]' : 'bg-gray-600/40'
                }`}
                title={tool.enabled ? 'Disable' : 'Enable'}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                    tool.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={() => changeMode('view')}
                className="p-1 theme-text-secondary hover-theme-text-primary transition-colors"
                title="View tool structure"
              >
                <Eye className="w-3 h-3" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={startEdit}
                className="p-1 theme-text-secondary hover-theme-text-primary transition-colors"
                title="Edit"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={tool.enabled}
                onClick={onToggle}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                  tool.enabled ? 'bg-[var(--accent)]' : 'bg-gray-600/40'
                }`}
                title={tool.enabled ? 'Disable' : 'Enable'}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                    tool.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="p-1 theme-text-secondary hover:text-red-400 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
