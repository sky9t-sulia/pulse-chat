import { useState, useEffect, useRef } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
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
      className={`sidebar-item flex items-center gap-1 px-2 py-2 rounded-lg cursor-pointer group ${
        isActive ? 'theme-sidebar-active' : ''
      }`}
      onClick={() => {
        if (!editing) {
          onSelect(conversation.id);
          onCloseSettings?.();
        }
      }}
    >
      <svg
        className="w-4 h-4 flex-shrink-0 theme-text-secondary"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
        />
      </svg>
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
          className="flex-1 text-sm theme-text-primary bg-transparent outline-none border-b border-gray-500 truncate"
        />
      ) : (
        <>
          <span className="flex-1 text-sm theme-text-primary truncate">{conversation.title}</span>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="p-0.5 rounded hover-theme-sidebar-hover transition-all"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
              title="Rename"
            >
              <Pencil className="w-3 h-3 theme-text-secondary hover-theme-text-primary" />
            </button>
            <button
              className="p-0.5 rounded hover-theme-sidebar-hover transition-all"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conversation.id);
              }}
              title="Delete"
            >
              <Trash2 className="w-3 h-3 theme-text-secondary hover-theme-text-primary" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
