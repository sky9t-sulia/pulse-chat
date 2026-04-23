import { useApp } from '../context/AppContext';
import { Plus, Trash2, Settings, Sun, Moon } from 'lucide-react';
import { useState } from 'react';
import SettingsModal from './SettingsModal';
import type { Conversation } from '../types';

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
}: {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className={`sidebar-item flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer group ${
        isActive ? 'theme-sidebar-active' : ''
      }`}
      onClick={() => onSelect(conversation.id)}
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
      <span className="flex-1 text-sm theme-text-primary truncate">{conversation.title}</span>
      <button
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover-theme-sidebar-hover transition-all"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(conversation.id);
        }}
      >
        <Trash2 className="w-3.5 h-3.5 theme-text-secondary hover-theme-text-primary" />
      </button>
    </div>
  );
}

export default function Sidebar() {
  const {
    conversations,
    activeConversationId,
    theme,
    setTheme,
    setActiveConversationId,
    createConversation,
    deleteConversation,
  } = useApp();

  const [showSettings, setShowSettings] = useState(false);

  const handleNewChat = async () => {
    const conv = await createConversation('New Chat');
    setActiveConversationId(conv.id);
  };

  return (
    <aside className="w-64 flex-shrink-0 theme-sidebar flex flex-col h-full border-r theme-border">
      {/* Header */}
      <div className="p-3">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-transparent border theme-border-light rounded-lg theme-text-primary hover-theme-sidebar-hover transition-all text-sm"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 && (
          <div className="px-3 py-8 text-center">
            <p className="text-xs theme-text-tertiary">No conversations yet</p>
          </div>
        )}
        {conversations.map((conv) => (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            isActive={conv.id === activeConversationId}
            onSelect={setActiveConversationId}
            onDelete={deleteConversation}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t theme-border space-y-1">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="sidebar-item w-full flex items-center gap-2 px-3 py-2 rounded-lg theme-text-secondary hover-theme-text-primary text-sm"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        {/* Settings */}
        <button
          onClick={() => setShowSettings(true)}
          className="sidebar-item w-full flex items-center gap-2 px-3 py-2 rounded-lg theme-text-secondary hover-theme-text-primary text-sm"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>

      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </aside>
  );
}
