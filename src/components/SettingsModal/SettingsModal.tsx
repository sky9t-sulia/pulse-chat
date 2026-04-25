import { useState } from 'react';
import { X } from 'lucide-react';
import { ProvidersTab } from './ProvidersTab';
import { ToolsTab } from './ToolsTab';
import { ChatSettingsTab } from './ChatSettingsTab';

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'providers' | 'tools' | 'chat'>('providers');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium theme-text-heading">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 theme-text-secondary hover-theme-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-1 mb-5 border-b theme-border">
          <button
            onClick={() => setTab('providers')}
            className={`px-3 py-2 text-sm transition-colors border-b-2 -mb-px ${
              tab === 'providers'
                ? 'theme-text-primary border-gray-400'
                : 'theme-text-secondary border-transparent hover-theme-text-primary'
            }`}
          >
            Providers
          </button>
          <button
            onClick={() => setTab('tools')}
            className={`px-3 py-2 text-sm transition-colors border-b-2 -mb-px ${
              tab === 'tools'
                ? 'theme-text-primary border-gray-400'
                : 'theme-text-secondary border-transparent hover-theme-text-primary'
            }`}
          >
            Tools
          </button>
          <button
            onClick={() => setTab('chat')}
            className={`px-3 py-2 text-sm transition-colors border-b-2 -mb-px ${
              tab === 'chat'
                ? 'theme-text-primary border-gray-400'
                : 'theme-text-secondary border-transparent hover-theme-text-primary'
            }`}
          >
            Chat
          </button>
        </div>

        {tab === 'providers' ? <ProvidersTab /> : tab === 'tools' ? <ToolsTab /> : <ChatSettingsTab />}

        <div className="pt-4 mt-6 border-t theme-border">
          <p className="text-xs theme-text-muted">
            {import.meta.env.PACKAGE_NAME} v{import.meta.env.PACKAGE_VERSION || '1.0.0'} — Local-first LLM desktop client
          </p>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
