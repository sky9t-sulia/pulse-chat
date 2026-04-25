import { useState, useRef, useCallback } from 'react';
import { useToolRegistry } from '../../context/tools';
import { Plus, PenTool } from 'lucide-react';
import type { Tool } from '../../types/types';
import { InlineToolItem } from './InlineToolItem';
import { ToolsTabForm } from './ToolsTabForm';

interface AddToolState {
  name: string;
  description: string;
  parameters: string;
  handlerCode: string;
  paramError: string | null;
}

export function ToolsTab() {
  const { tools, enabledTools, addTool, deleteTool, updateTool, reorderTools } = useToolRegistry();
  const [showAdd, setShowAdd] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const [addState, setAddState] = useState<AddToolState>({
    name: '', description: '', parameters: '{}', handlerCode: '', paramError: null,
  });
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const customTools = tools.filter((tool) => !tool.is_built_in);
  const builtInTools = tools.filter((tool) => tool.is_built_in);
  const isAnyActive = showAdd || activeCount > 0;

  const openAdd = () => {
    setAddState({ name: '', description: '', parameters: '{}', handlerCode: '', paramError: null });
    setShowAdd(true);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setAddState((prev) => ({ ...prev, paramError: null }));
    let parsed: unknown;
    try {
      parsed = JSON.parse(addState.parameters);
    } catch {
      setAddState((prev) => ({ ...prev, paramError: 'Invalid JSON in parameters' }));
      return;
    }
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      (parsed as Record<string, unknown>).type = (parsed as Record<string, unknown>).type || 'object';
    } else {
      setAddState((prev) => ({ ...prev, paramError: 'Parameters must be a JSON object with type: "object"' }));
      return;
    }
    addTool({
      name: addState.name, description: addState.description,
      parameters: parsed as Record<string, unknown>, handler_code: addState.handlerCode,
      enabled: true, is_built_in: false, sort_order: customTools.length,
    });
    setShowAdd(false);
  };

  const handleReorder = useCallback(() => {
    if (dragIdx !== null && dropIdx !== null && dragIdx !== dropIdx) {
      const newOrder = [...customTools.map((tool) => tool.id)];
      const [moved] = newOrder.splice(dragIdx, 1);
      newOrder.splice(dropIdx, 0, moved);
      reorderTools(newOrder);
    }
    setDragIdx(null);
    setDropIdx(null);
  }, [dragIdx, dropIdx, customTools, reorderTools]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (dragIdx === null || listRef.current === null) return;
    const children = Array.from(listRef.current.children) as HTMLElement[];
    let targetIdx = children.length;
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) { targetIdx = i; break; }
    }
    if (dragIdx < targetIdx) targetIdx = Math.max(targetIdx - 1, 0);
    setDropIdx(targetIdx);
  }, [dragIdx]);

  const renderToolItem = (tool: Tool, index: number, isCustom: boolean) => (
    <InlineToolItem
      key={tool.id}
      tool={tool}
      index={index}
      isDragged={isCustom && dragIdx === index}
      isDropTarget={isCustom && dropIdx === index}
      isCustom={isCustom}
      setDragItem={(v) => setDragIdx(v)}
      onToggle={() => updateTool(tool.id, { enabled: !tool.enabled })}
      onDelete={() => deleteTool(tool.id)}
      onUpdate={(data) => updateTool(tool.id, data)}
      onModeChange={(isActive) => setActiveCount((count) => count + (isActive ? 1 : -1))}
    />
  );

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
              onDragOver={handleDragOver}
              onDragLeave={() => {
                if (listRef.current && !listRef.current.contains(document.activeElement)) {
                  setDropIdx(null);
                }
              }}
              onDrop={handleReorder}
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
            name={addState.name}
            description={addState.description}
            parameters={addState.parameters}
            handlerCode={addState.handlerCode}
            paramError={addState.paramError}
            onChangeName={(e) => setAddState((prev) => ({ ...prev, name: e.target.value }))}
            onChangeDescription={(e) => setAddState((prev) => ({ ...prev, description: e.target.value }))}
            onChangeParameters={(e) => { setAddState((prev) => ({ ...prev, parameters: e.target.value, paramError: null })); }}
            onChangeHandlerCode={(e) => setAddState((prev) => ({ ...prev, handlerCode: e.target.value }))}
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
            {/* Placeholder for Plug icon — imported from lucide-react */}
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
