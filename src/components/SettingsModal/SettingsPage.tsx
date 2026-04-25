import { useState } from 'react';
import { ArrowLeft, Server, Wrench, MessageSquare } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ProvidersTab } from './ProvidersTab';
import { ToolsTab } from './ToolsTab';
import { ChatSettingsTab } from './ChatSettingsTab';

const tabs = [
  { id: 'providers' as const, label: 'LM Providers', icon: Server },
  { id: 'tools' as const, label: 'Tools', icon: Wrench },
  { id: 'chat' as const, label: 'Chat Settings', icon: MessageSquare },
];

export function SettingsPage() {
  const { setShowSettings } = useApp();
  const [tab, setTab] = useState<'providers' | 'tools' | 'chat'>('providers');
  const active = tabs.find((t) => t.id === tab)!;

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Sidebar tabs */}
      <div className="w-48 flex-shrink-0 flex flex-col bg-[var(--bg-sidebar-transparent)]">
        <div className="flex items-center gap-2 px-4 py-3 theme-border">
          <button
            onClick={() => setShowSettings(false)}
            className="p-1 theme-text-secondary hover-theme-text-primary transition-colors rounded"
            title="Back to chat"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium theme-text-heading">Settings</span>
        </div>

        <nav className="flex-1 py-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                  isActive
                    ? 'theme-sidebar-active theme-text-primary font-medium'
                    : 'theme-text-secondary hover-theme-text-primary'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3">
          <p className="text-xs theme-text-muted">
            {import.meta.env.PACKAGE_NAME} v{import.meta.env.PACKAGE_VERSION || '1.0.0'}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-8 pt-6 pb-4 flex-shrink-0">
          <h2 className="text-lg font-medium theme-text-heading">{active.label}</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-6">
          <>
            {tab === 'providers' ? <ProvidersTab /> : tab === 'tools' ? <ToolsTab /> : <ChatSettingsTab />}
          </>
        </div>
      </div>
    </div>
  );
}
