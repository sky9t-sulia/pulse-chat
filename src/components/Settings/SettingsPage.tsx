import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Server, Wrench, MessageCircle, Plus, UserRoundPen } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToolRegistry } from '../../context/tools';
import { ProvidersTab } from './ProvidersTab';
import { ToolsTab } from './ToolsTab';
import { ChatSettingsTab } from './ChatSettingsTab';
import { ProfileTab } from './ProfileTab';
import { ProviderForm } from './ProviderForm/ProviderForm';
import { ToolsTabForm } from './ToolsTabForm';
import { Dialog } from './Dialog';
import type { Provider, Tool } from '../../types/types';

const tabs = [
  { id: 'providers' as const, label: 'LM Providers', icon: Server },
  { id: 'tools' as const, label: 'Tools', icon: Wrench },
  { id: 'chat' as const, label: 'Chat Settings', icon: MessageCircle },
  { id: 'profile' as const, label: 'Profile', icon: UserRoundPen },
];

interface AddToolState {
  name: string;
  description: string;
  parameters: string;
  handlerCode: string;
  paramError: string | null;
}

type ToolFormMode = 'add' | 'edit' | 'view' | null;

export function SettingsPage() {
  const { setShowSettings, providers, activeProvider, addProvider, updateProvider, deleteProvider, setActiveProvider } = useApp();
  const { tools, addTool, deleteTool, updateTool, reorderTools } = useToolRegistry();
  const [tab, setTab] = useState<typeof tabs[number]['id']>('providers');
  const [closing, setClosing] = useState(false);

  // Provider form state
  const [providerForm, setProviderForm] = useState<{ show: boolean; editing?: Provider }>({ show: false });

  // Tool form state
  const [toolForm, setToolForm] = useState<{ mode: ToolFormMode; tool?: Tool; state: AddToolState }>({
    mode: null,
    state: { name: '', description: '', parameters: '{}', handlerCode: '', paramError: null },
  });

  const active = tabs.find((t) => t.id === tab)!;

  const handleClose = () => setClosing(true);

  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => setShowSettings(false), 150);
    return () => clearTimeout(t);
  }, [closing, setShowSettings]);

  // Provider handlers
  const openProviderForm = useCallback((provider?: Provider) => {
    setProviderForm({ show: true, editing: provider });
  }, []);
  const closeProviderForm = useCallback(() => {
    setProviderForm({ show: false, editing: undefined });
  }, []);

  const handleProviderSave = useCallback(
    (data: Omit<Provider, 'id' | 'created_at' | 'updated_at'>) => {
      if (providerForm.editing) {
        updateProvider(providerForm.editing.id, data);
      } else {
        addProvider(data);
      }
      closeProviderForm();
    },
    [providerForm.editing, updateProvider, addProvider, closeProviderForm]
  );

  const handleProviderDelete = useCallback(
    (id: string) => {
      if (activeProvider?.id === id) setActiveProvider(null);
      deleteProvider(id);
    },
    [activeProvider, deleteProvider, setActiveProvider]
  );

  // Tool handlers
  const openToolAdd = useCallback(() => {
    setToolForm({
      mode: 'add',
      state: { name: '', description: '', parameters: '{}', handlerCode: '', paramError: null },
    });
  }, []);
  const openToolEdit = useCallback((tool: Tool) => {
    setToolForm({
      mode: 'edit',
      tool,
      state: {
        name: tool.name,
        description: tool.description,
        parameters: JSON.stringify(tool.parameters, null, 2),
        handlerCode: tool.handler_code || '',
        paramError: null,
      },
    });
  }, []);
  const openToolView = useCallback((tool: Tool) => {
    setToolForm({
      mode: 'view',
      tool,
      state: {
        name: tool.name,
        description: tool.description,
        parameters: JSON.stringify(tool.parameters, null, 2),
        handlerCode: tool.handler_code || '',
        paramError: null,
      },
    });
  }, []);
  const closeToolForm = useCallback(() => {
    setToolForm({ mode: null, state: toolForm.state });
  }, [toolForm.state]);

  const handleToolAdd = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      let parsed: unknown;
      try {
        parsed = JSON.parse(toolForm.state.parameters);
      } catch {
        setToolForm((prev) => ({ ...prev, state: { ...prev.state, paramError: 'Invalid JSON in parameters' } }));
        return;
      }
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        (parsed as Record<string, unknown>).type = (parsed as Record<string, unknown>).type || 'object';
      } else {
        setToolForm((prev) => ({ ...prev, state: { ...prev.state, paramError: 'Parameters must be a JSON object with type: "object"' } }));
        return;
      }
      const customTools = tools.filter((t) => !t.is_built_in);
      addTool({
        name: toolForm.state.name,
        description: toolForm.state.description,
        parameters: parsed as Record<string, unknown>,
        handler_code: toolForm.state.handlerCode,
        enabled: true,
        is_built_in: false,
        sort_order: customTools.length,
      });
      setToolForm({ mode: null, state: toolForm.state });
    },
    [toolForm.state, tools, addTool]
  );

  const handleToolEdit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!toolForm.tool) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(toolForm.state.parameters);
      } catch {
        setToolForm((prev) => ({ ...prev, state: { ...prev.state, paramError: 'Invalid JSON in parameters' } }));
        return;
      }
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        (parsed as Record<string, unknown>).type = (parsed as Record<string, unknown>).type || 'object';
      } else {
        setToolForm((prev) => ({ ...prev, state: { ...prev.state, paramError: 'Parameters must be a JSON object with type: "object"' } }));
        return;
      }
      updateTool(toolForm.tool.id, {
        name: toolForm.state.name,
        description: toolForm.state.description,
        parameters: parsed as Record<string, unknown>,
        handler_code: toolForm.state.handlerCode,
      });
      setToolForm({ mode: null, state: toolForm.state });
    },
    [toolForm.state, toolForm.tool, updateTool]
  );

  const customTools = tools.filter((t) => !t.is_built_in);
  const builtInTools = tools.filter((t) => t.is_built_in);

  return (
    <div className={`flex-1 flex h-full overflow-hidden ${closing ? 'settings-exit' : 'settings-enter'}`}>
      {/* Sidebar tabs */}
      <div className="w-48 shrink-0 flex flex-col bg-(--bg-sidebar-transparent)">
        <div className="flex items-center gap-2 px-4 py-3 theme-border">
          <button
            onClick={handleClose}
            className="p-1 theme-text-secondary hover-theme-text-primary transition-colors rounded"
            title="Back to chat"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium theme-text-heading">Settings</span>
        </div>

        <nav className="flex-1 py-2">
          {tabs.map((tabItem) => {
            const Icon = tabItem.icon;
            const isActive = tab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                onClick={() => setTab(tabItem.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs transition-colors ${
                  isActive
                    ? 'theme-sidebar-active theme-text-primary font-medium'
                    : 'theme-text-secondary hover-theme-text-primary'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {tabItem.label}
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
      <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
        <div className="pt-4 px-8 pb-6 max-w-3xl w-full mx-auto">
          <div className="flex items-center justify-between mb-4 min-h-7">
            <h2 className="text-sm font-medium theme-text-heading">{active.label}</h2>
            {tab === 'providers' && !providerForm.show && (
              <button
                onClick={() => openProviderForm()}
                className="text-xs bg-(--accent) hover:bg-(--accent-hover) text-white px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Provider
              </button>
            )}
            {tab === 'tools' && toolForm.mode === null && (
              <button
                onClick={openToolAdd}
                className="text-xs bg-(--accent) hover:bg-(--accent-hover) text-white px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Tool
              </button>
            )}
          </div>

          {/* Tab content */}
          <>
            {tab === 'providers' && (
              <ProvidersTab
                providers={providers}
                activeProvider={activeProvider}
                onEdit={(p) => openProviderForm(p)}
                onDelete={handleProviderDelete}
                onSelect={(p) => { setActiveProvider(p); }}
              />
            )}
            {tab === 'tools' && (
              <ToolsTab
                customTools={customTools}
                builtInTools={builtInTools}
                onEditTool={openToolEdit}
                onViewTool={openToolView}
                updateTool={updateTool}
                deleteTool={deleteTool}
                reorderTools={reorderTools}
              />
            )}
            {tab === 'chat' && <ChatSettingsTab />}
            {tab === 'profile' && <ProfileTab />}
          </>
        </div>
      </div>

      {/* Provider form modal */}
      <Dialog
        open={providerForm.show}
        onClose={closeProviderForm}
        title={providerForm.editing ? 'Edit Provider' : 'Add Provider'}
      >
        <ProviderForm
          initial={providerForm.editing}
          onSave={handleProviderSave}
          onCancel={closeProviderForm}
        />
      </Dialog>

      {/* Tool form modal */}
      <Dialog
        open={toolForm.mode !== null}
        onClose={closeToolForm}
        title={
          toolForm.mode === 'add' ? 'Add Tool' :
          toolForm.mode === 'edit' ? `Edit: ${toolForm.tool?.name}` :
          toolForm.tool ? toolForm.tool.name : ''
        }
      >
        <ToolsTabForm
          name={toolForm.state.name}
          description={toolForm.state.description}
          parameters={toolForm.state.parameters}
          handlerCode={toolForm.state.handlerCode}
          paramError={toolForm.state.paramError}
          readOnly={toolForm.mode === 'view'}
          onChangeName={(e) => setToolForm((prev) => ({ ...prev, state: { ...prev.state, name: e.target.value } }))}
          onChangeDescription={(e) => setToolForm((prev) => ({ ...prev, state: { ...prev.state, description: e.target.value } }))}
          onChangeParameters={(e) => setToolForm((prev) => ({ ...prev, state: { ...prev.state, parameters: e.target.value, paramError: null } }))}
          onChangeHandlerCode={(e) => setToolForm((prev) => ({ ...prev, state: { ...prev.state, handlerCode: e.target.value } }))}
          onSubmit={toolForm.mode === 'view' ? undefined : (toolForm.mode === 'add' ? handleToolAdd : handleToolEdit)}
          onCancel={closeToolForm}
          submitLabel={toolForm.mode === 'add' ? 'Add' : toolForm.mode === 'edit' ? 'Update' : ''}
        />
      </Dialog>
    </div>
  );
}
