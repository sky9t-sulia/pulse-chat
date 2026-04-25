import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Pencil, Trash2 } from 'lucide-react';
import type { Conversation } from '../../types/types';

interface Props {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onCloseSettings?: () => void;
}

export function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onRename,
  onCloseSettings,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(conversation.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setTitle(conversation.title);
  }, [conversation.title, editing]);

  const commitEdit = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== conversation.title) {
      onRename(conversation.id, trimmed);
    } else {
      setTitle(conversation.title);
    }
    setEditing(false);
  };

  return (
    <div
      className={`gap-2 sidebar-item flex items-center px-2 py-2 rounded-lg cursor-pointer group ${
        isActive ? 'theme-sidebar-active theme-text-primary' : 'theme-text-secondary'
      }`}
      onClick={() => {
        if (!editing) {
          onSelect(conversation.id);
          onCloseSettings?.();
        }
      }}
    >
      <MessageCircle className='w-4 h-4' />
      {editing ? (
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit();
            if (e.key === 'Escape') { setTitle(conversation.title); setEditing(false); }
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 text-xs bg-transparent outline-none border-b border-gray-500 truncate"
        />
      ) : (
        <>
          <span className="flex-1 text-xs truncate">{conversation.title}</span>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="p-0.5 rounded hover-theme-sidebar-hover transition-all"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
              title="Rename"
            >
              <Pencil className="w-3 h-3 hover-theme-text-primary" />
            </button>
            <button
              className="p-0.5 rounded hover-theme-sidebar-hover transition-all"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conversation.id);
              }}
              title="Delete"
            >
              <Trash2 className="w-3 h-3 hover-theme-text-primary" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
