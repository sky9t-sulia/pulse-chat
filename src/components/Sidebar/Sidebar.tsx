import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Plus, Settings, Sun, Moon, PanelLeftClose, PanelLeft } from 'lucide-react';
import { ConversationItem } from './ConversationItem';

export default function Sidebar() {
  const {
    conversations,
    activeConversationId,
    theme,
    setTheme,
    setActiveConversationId,
    createConversation,
    deleteConversation,
    updateConversationTitle,
    setShowSettings,
  } = useApp();

  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === '1';
  });

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  const handleNewChat = async () => {
    const conv = await createConversation('New Chat');
    setActiveConversationId(conv.id);
    setShowSettings(false);
  };

  return (
    <aside
      className={`flex-shrink-0 theme-sidebar flex flex-col h-full border-r theme-border transition-[width] duration-150 ${
        collapsed ? 'w-12' : 'w-72'
      }`}
    >
      {/* Header */}
      <div className={`p-2 flex items-center gap-1 ${collapsed ? 'flex-col' : ''}`}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="sidebar-item p-2 rounded-lg theme-text-secondary hover-theme-text-primary"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
        <button
          onClick={handleNewChat}
          className={`sidebar-item p-2 rounded-lg theme-text-secondary hover-theme-text-primary ${
            collapsed ? '' : 'ml-auto'
          }`}
          title="New chat"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Conversation list */}
      {!collapsed && (
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
              onRename={updateConversationTitle}
              onCloseSettings={() => setShowSettings(false)}
            />
          ))}
        </div>
      )}
      {collapsed && <div className="flex-1" />}

      {/* Footer */}
      <div className={`${collapsed ? 'p-2 space-y-1' : 'p-3 space-y-1'}`}>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={`sidebar-item rounded-lg theme-text-secondary hover-theme-text-primary text-sm ${
            collapsed
              ? 'w-full flex items-center justify-center p-2'
              : 'w-full flex items-center gap-2 px-3 py-2'
          }`}
          title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {!collapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        <button
          onClick={() => setShowSettings(true)}
          className={`sidebar-item rounded-lg theme-text-secondary hover-theme-text-primary text-sm ${
            collapsed
              ? 'w-full flex items-center justify-center p-2'
              : 'w-full flex items-center gap-2 px-3 py-2'
          }`}
          title="Settings"
        >
          <Settings className="w-4 h-4" />
          {!collapsed && <span>Settings</span>}
        </button>
      </div>

    </aside>
  );
}
