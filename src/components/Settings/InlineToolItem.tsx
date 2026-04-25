import { Wrench, Eye, Pencil, Trash2, GripVertical } from 'lucide-react';
import type { Tool } from '../../types/types';

interface InlineToolItemProps {
  tool: Tool;
  index: number;
  isDragged: boolean;
  isDropTarget: boolean;
  isCustom: boolean;
  setDragItem: (v: number | null) => void;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onView: () => void;
}

export function InlineToolItem({
  tool, index, isDragged, isDropTarget, isCustom,
  setDragItem, onToggle, onDelete, onEdit, onView,
}: InlineToolItemProps) {
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
                onClick={onView}
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
                onClick={onEdit}
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
