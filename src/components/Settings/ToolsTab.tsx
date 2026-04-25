import { useState, useRef, useCallback } from 'react';
import { useToolRegistry } from '../../context/tools';
import { PenTool } from 'lucide-react';
import type { Tool } from '../../types/types';
import { InlineToolItem } from './InlineToolItem';
import { SectionLabel } from './SectionLabel';

interface ToolsTabProps {
  customTools: Tool[];
  builtInTools: Tool[];
  onEditTool: (tool: Tool) => void;
  onViewTool: (tool: Tool) => void;
  updateTool: (id: string, data: Partial<Tool>) => void;
  deleteTool: (id: string) => void;
  reorderTools: (order: string[]) => void;
}

export function ToolsTab({ customTools, builtInTools, onEditTool, onViewTool, updateTool, deleteTool, reorderTools }: ToolsTabProps) {
  const { tools } = useToolRegistry();
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

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
      onEdit={() => onEditTool(tool)}
      onView={() => onViewTool(tool)}
    />
  );

  return (
    <div>
      {/* Custom tools */}
      <div>
        {customTools.length > 0 && (
          <>
            <div className="flex items-center gap-1.5 mb-2">
              <PenTool className="w-3 h-3 theme-text-muted" />
              <SectionLabel>Custom</SectionLabel>
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
      </div>

      {/* Built-in tools */}
      {builtInTools.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-1.5">
            {/* Placeholder for Plug icon — imported from lucide-react */}
            <SectionLabel>Built-in</SectionLabel>
          </div>
          <div className="space-y-2">
            {builtInTools.map((tool, index) => renderToolItem(tool, index, false))}
          </div>
        </div>
      )}

      {tools.filter((t) => t.enabled).length > 0 && (
        <p className="text-xs theme-text-muted mt-3 text-center">
          {tools.filter((t) => t.enabled).length} tool{tools.filter((t) => t.enabled).length !== 1 ? 's' : ''} enabled — available to your model during chat.
        </p>
      )}
    </div>
  );
}
