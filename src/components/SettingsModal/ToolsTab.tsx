import { useState } from 'react';
import { useToolRegistry } from '../../context/tools';
import { Plus, Trash2, Pencil, Wrench, Eye } from 'lucide-react';
import type { Tool } from '../../types/types';
import { ToolsTabForm } from './ToolsTabForm';

export function ToolsTab() {
  const { tools, enabledTools, addTool, deleteTool, updateTool } = useToolRegistry();
  const [showAdd, setShowAdd] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const isAnyActive = showAdd || activeCount > 0;
  const [addName, setAddName] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addParameters, setAddParameters] = useState('{}');
  const [addParamError, setAddParamError] = useState<string | null>(null);

  const openAdd = () => {
    setAddName('');
    setAddDescription('');
    setAddParameters('{}');
    setAddParamError(null);
    setShowAdd(true);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setAddParamError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(addParameters);
    } catch {
      setAddParamError('Invalid JSON in parameters');
      return;
    }
    addTool({ name: addName, description: addDescription, parameters: parsed as Record<string, unknown>, enabled: true, is_built_in: false });
    setShowAdd(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium theme-text-primary">Tools</h3>
        {!isAnyActive && (
          <button
            onClick={openAdd}
            className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add Tool
          </button>
        )}
      </div>

      <div className="space-y-2">
        {tools.length === 0 && !isAnyActive ? (
          <p className="text-xs theme-text-muted text-center py-4">No tools configured.</p>
        ) : (
          tools.map((tool) => (
            <InlineToolItem
              key={tool.id}
              tool={tool}
              onToggle={() => updateTool(tool.id, { enabled: !tool.enabled })}
              onDelete={() => deleteTool(tool.id)}
              onUpdate={(data) => updateTool(tool.id, data)}
              onModeChange={(active) => setActiveCount((n) => n + (active ? 1 : -1))}
            />
          ))
        )}

        {showAdd && (
          <ToolsTabForm
            title="Add Tool"
            name={addName}
            description={addDescription}
            parameters={addParameters}
            paramError={addParamError}
            onChangeName={(e) => setAddName(e.target.value)}
            onChangeDescription={(e) => setAddDescription(e.target.value)}
            onChangeParameters={(e) => { setAddParameters(e.target.value); setAddParamError(null); }}
            onSubmit={handleAdd}
            onCancel={() => setShowAdd(false)}
            submitLabel="Add"
          />
        )}
      </div>

      {enabledTools.length > 0 && (
        <p className="text-xs theme-text-muted mt-3 text-center">
          {enabledTools.length} tool{enabledTools.length !== 1 ? 's' : ''} enabled — available to your model during chat.
        </p>
      )}
    </div>
  );
}

function InlineToolItem({
  tool,
  onToggle,
  onDelete,
  onUpdate,
  onModeChange,
}: {
  tool: Tool;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: (data: Partial<Omit<Tool, 'id' | 'created_at' | 'updated_at'>>) => void;
  onModeChange: (active: boolean) => void;
}) {
  const [mode, setMode] = useState<'row' | 'edit' | 'view'>('row');

  const changeMode = (next: 'row' | 'edit' | 'view') => {
    const wasActive = mode !== 'row';
    const willBeActive = next !== 'row';
    if (wasActive !== willBeActive) onModeChange(willBeActive);
    setMode(next);
  };
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parameters, setParameters] = useState('');
  const [paramError, setParamError] = useState<string | null>(null);

  const startEdit = () => {
    setName(tool.name);
    setDescription(tool.description);
    setParameters(JSON.stringify(tool.parameters, null, 2));
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
    onUpdate({ name, description, parameters: parsed as Record<string, unknown> });
    changeMode('row');
  };

  if (mode !== 'row') {
    const readOnly = mode === 'view';
    return (
      <ToolsTabForm
        title={readOnly ? tool.name : 'Edit Tool'}
        name={readOnly ? tool.name : name}
        description={readOnly ? tool.description : description}
        parameters={readOnly ? JSON.stringify(tool.parameters, null, 2) : parameters}
        paramError={paramError}
        readOnly={readOnly}
        onChangeName={(e) => setName(e.target.value)}
        onChangeDescription={(e) => setDescription(e.target.value)}
        onChangeParameters={(e) => { setParameters(e.target.value); setParamError(null); }}
        onSubmit={readOnly ? undefined : handleSubmit}
        onCancel={cancel}
        submitLabel="Update"
      />
    );
  }

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 border theme-border-light rounded-lg transition-colors ${
        !tool.enabled ? 'opacity-50' : ''
      }`}
    >
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
          <button
            type="button"
            onClick={() => changeMode('view')}
            className="p-1 theme-text-secondary hover-theme-text-primary transition-colors"
            title="View tool structure"
          >
            <Eye className="w-3 h-3" />
          </button>
        ) : (
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
              onClick={startEdit}
              className="p-1 theme-text-secondary hover-theme-text-primary transition-colors"
              title="Edit"
            >
              <Pencil className="w-3 h-3" />
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
  );
}
