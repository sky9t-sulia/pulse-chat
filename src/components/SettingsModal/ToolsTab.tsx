import { useState, useRef, useCallback } from 'react';
import { useToolRegistry } from '../../context/tools';
import { Plus, Trash2, Pencil, Wrench, Eye, GripVertical, Plug, PenTool } from 'lucide-react';
import type { Tool } from '../../types/types';
import { ToolsTabForm } from './ToolsTabForm';

export function ToolsTab() {
  const { tools, enabledTools, addTool, deleteTool, updateTool, reorderTools } = useToolRegistry();
  const [showAdd, setShowAdd] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const isAnyActive = showAdd || activeCount > 0;
  const [addName, setAddName] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addParameters, setAddParameters] = useState('{}');
  const [addHandlerCode, setAddHandlerCode] = useState('');
  const [addParamError, setAddParamError] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const customTools = tools.filter((t) => !t.is_built_in);
  const builtInTools = tools.filter((t) => t.is_built_in);

  const openAdd = () => {
    setAddName('');
    setAddDescription('');
    setAddParameters('{}');
    setAddHandlerCode('');
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
    // Ensure parameters always has type: "object" for API compatibility
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      (parsed as Record<string, unknown>).type = (parsed as Record<string, unknown>).type || 'object';
    } else {
      setAddParamError('Parameters must be a JSON object with type: "object"');
      return;
    }
    addTool({ name: addName, description: addDescription, parameters: parsed as Record<string, unknown>, handler_code: addHandlerCode, enabled: true, is_built_in: false, sort_order: customTools.length });
    setShowAdd(false);
  };

  const handleReorder = useCallback(() => {
    if (dragIdx !== null && dropIdx !== null && dragIdx !== dropIdx) {
      const newOrder = [...customTools.map((t) => t.id)];
      const [moved] = newOrder.splice(dragIdx, 1);
      newOrder.splice(dropIdx, 0, moved);
      reorderTools(newOrder);
    }
    setDragIdx(null);
    setDropIdx(null);
  }, [dragIdx, dropIdx, customTools, reorderTools]);

  const renderToolItem = (tool: Tool, index: number, isCustom: boolean) => {
    const isDragged = isCustom && dragIdx === index;
    const isDropTarget = isCustom && dropIdx === index;
    const showIndicator = isCustom && dropIdx === index && dragIdx !== null && dragIdx !== index;
    return (
      <div key={tool.id}>
        {showIndicator && (
          <div className="h-0.5 -my-1 mx-2 rounded bg-[var(--accent)] transition-opacity" />
        )}
        <InlineToolItem
          tool={tool}
          index={index}
          isDragged={isDragged}
          isDropTarget={isDropTarget}
          isCustom={isCustom}
          setDragItem={(v) => setDragIdx(v)}
          onToggle={() => updateTool(tool.id, { enabled: !tool.enabled })}
          onDelete={() => deleteTool(tool.id)}
          onUpdate={(data) => updateTool(tool.id, data)}
          onModeChange={(active) => setActiveCount((n) => n + (active ? 1 : -1))}
        />
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium theme-text-primary"></h3>
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

      {/* Custom tools */}
      <div>
        {customTools.length > 0 && (
          <>
          <div className="flex items-center gap-1.5 mb-2">
            <PenTool className="w-3 h-3 theme-text-muted" />
            <h4 className="text-[11px] font-medium theme-text-muted uppercase tracking-wider">Custom</h4>
          </div>
            <div
              ref={listRef}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragIdx === null || listRef.current === null) return;
                const el = listRef.current;
                const children = Array.from(el.children) as HTMLElement[];
                let targetIdx = children.length;
                for (let i = 0; i < children.length; i++) {
                  const rect = children[i].getBoundingClientRect();
                  const midY = rect.top + rect.height / 2;
                  if (e.clientY < midY) {
                    targetIdx = i;
                    break;
                  }
                }
                if (dragIdx < targetIdx) {
                  targetIdx = Math.max(targetIdx - 1, 0);
                }
                setDropIdx(targetIdx);
              }}
              onDragLeave={() => {
                if (listRef.current && !listRef.current.contains(document.activeElement)) {
                  setDropIdx(null);
                }
              }}
              onDrop={() => handleReorder()}
              onDragEnd={() => { setDragIdx(null); setDropIdx(null); }}
              className="space-y-2"
            >
              {customTools.map((tool, index) => renderToolItem(tool, index, true))}
            </div>
          </>
        )}

        {showAdd && (
          <ToolsTabForm
            title="Add Tool"
            name={addName}
            description={addDescription}
            parameters={addParameters}
            handlerCode={addHandlerCode}
            paramError={addParamError}
            onChangeName={(e) => setAddName(e.target.value)}
            onChangeDescription={(e) => setAddDescription(e.target.value)}
            onChangeParameters={(e) => { setAddParameters(e.target.value); setAddParamError(null); }}
            onChangeHandlerCode={(e) => setAddHandlerCode(e.target.value)}
            onSubmit={handleAdd}
            onCancel={() => setShowAdd(false)}
            submitLabel="Add"
          />
        )}
      </div>

      {/* Built-in tools */}
      {builtInTools.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Plug className="w-3 h-3 theme-text-muted" />
            <h4 className="text-[11px] font-medium theme-text-muted uppercase tracking-wider">Built-in</h4>
          </div>
          <div className="space-y-2">
            {builtInTools.map((tool, index) => renderToolItem(tool, index, false))}
          </div>
        </div>
      )}

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
  index,
  isDragged,
  isDropTarget,
  isCustom,
  setDragItem,
  onToggle,
  onDelete,
  onUpdate,
  onModeChange,
}: {
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
  const [handlerCode, setHandlerCode] = useState('');
  const [paramError, setParamError] = useState<string | null>(null);

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
    // Ensure parameters always has type: "object" for API compatibility
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      (parsed as Record<string, unknown>).type = (parsed as Record<string, unknown>).type || 'object';
    } else {
      setParamError('Parameters must be a JSON object with type: "object"');
      return;
    }
    onUpdate({ name, description, parameters: parsed as Record<string, unknown>, handler_code: handlerCode });
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
        handlerCode={readOnly ? (tool.handler_code || '') : handlerCode}
        paramError={paramError}
        readOnly={readOnly}
        onChangeName={(e) => setName(e.target.value)}
        onChangeDescription={(e) => setDescription(e.target.value)}
        onChangeParameters={(e) => { setParameters(e.target.value); setParamError(null); }}
        onChangeHandlerCode={(e) => setHandlerCode(e.target.value)}
        onSubmit={readOnly ? undefined : handleSubmit}
        onCancel={cancel}
        submitLabel="Update"
      />
    );
  }

  return (
    <div
      draggable={isCustom}
      onDragStart={() => isCustom && setDragItem(index)}
      onDragEnd={() => isCustom && setDragItem(null)}
      className={`flex items-center gap-3 px-3 py-2.5 border theme-border-light rounded-lg transition-colors ${
        isDragged ? 'opacity-40' : ''
      } ${isDropTarget ? 'border-[var(--accent)]' : ''}
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
  );
}
