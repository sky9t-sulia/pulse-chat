import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Tool } from '../types';

interface ToolRegistryContextType {
  tools: Tool[];
  enabledTools: Tool[];
  toolDefinitions: unknown[]; // OpenAI-compatible format for API
  refreshTools: () => Promise<void>;
  updateTool: (id: string, updates: Partial<Omit<Tool, 'id' | 'created_at' | 'updated_at'>>) => Promise<void>;
  addTool: (tool: Omit<Tool, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  deleteTool: (id: string) => Promise<void>;
}

const ToolRegistryContext = createContext<ToolRegistryContextType | null>(null);

export function useToolRegistry() {
  const ctx = useContext(ToolRegistryContext);
  if (!ctx) throw new Error('useToolRegistry must be used within ToolRegistryProvider');
  return ctx;
}

function convertToolToDefinition(tool: Tool): unknown {
  // Convert our Tool format to OpenAI-compatible tool definition
  const params = tool.parameters as { type?: string; properties?: Record<string, unknown>; required?: string[] };
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: params || { type: 'object', properties: {}, required: [] },
    },
  };
}

export function ToolRegistryProvider({ children }: { children: React.ReactNode }) {
  const [tools, setTools] = useState<Tool[]>([]);

  const refreshTools = useCallback(async () => {
    const list = await window.chatApi.tools.list();
    setTools(list);
  }, []);

  const updateTool = useCallback(
    async (id: string, updates: Partial<Omit<Tool, 'id' | 'created_at' | 'updated_at'>>) => {
      await window.chatApi.tools.update(id, updates);
      await refreshTools();
    },
    [refreshTools]
  );

  const addTool = useCallback(
    async (tool: Omit<Tool, 'id' | 'created_at' | 'updated_at'>) => {
      await window.chatApi.tools.create(tool);
      await refreshTools();
    },
    [refreshTools]
  );

  const deleteTool = useCallback(
    async (id: string) => {
      await window.chatApi.tools.delete(id);
      await refreshTools();
    },
    [refreshTools]
  );

  const enabledTools = tools.filter((t) => t.enabled);

  const toolDefinitions = enabledTools.map(convertToolToDefinition);

  useEffect(() => {
    refreshTools();
  }, [refreshTools]);

  const value: ToolRegistryContextType = {
    tools,
    enabledTools,
    toolDefinitions,
    refreshTools,
    updateTool,
    addTool,
    deleteTool,
  };

  return (
    <ToolRegistryContext.Provider value={value}>{children}</ToolRegistryContext.Provider>
  );
}
