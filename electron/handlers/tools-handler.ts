import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { builtInHandlers } from '../executors/built-in-tools';
import { query, run, saveDb } from '../database';

export function registerToolsHandlers(): void {
  ipcMain.handle('tools:list', () => {
    const rows = query<any>(`SELECT * FROM tools ORDER BY sort_order`);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      parameters: typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters,
      handler_code: row.handler_code || '',
      enabled: row.enabled === 1,
      is_built_in: row.is_built_in === 1,
      sort_order: row.sort_order,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  });

  ipcMain.handle(
    'tools:create',
    (_e, tool: { name: string; description: string; parameters: Record<string, unknown>; handler_code?: string; enabled?: boolean }) => {
      const id = uuidv4();
      const now = Date.now();
      run(
        'INSERT INTO tools (id, name, description, parameters, handler_code, enabled, is_built_in, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          id,
          tool.name,
          tool.description,
          JSON.stringify(tool.parameters),
          tool.handler_code || '',
          tool.enabled !== false ? 1 : 0,
          0,
          now,
          now,
        ]
      );
      saveDb();
      return {
        id,
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        handler_code: tool.handler_code || '',
        enabled: tool.enabled !== false,
        is_built_in: false,
        created_at: now,
        updated_at: now,
      };
    }
  );

  ipcMain.handle(
    'tools:update',
    (_e, id: string, tool: { name?: string; description?: string; parameters?: Record<string, unknown>; handler_code?: string; enabled?: boolean }) => {
      const sets: string[] = [];
      const params: any[] = [];
      if (tool.name !== undefined) { sets.push('name = ?'); params.push(tool.name); }
      if (tool.description !== undefined) { sets.push('description = ?'); params.push(tool.description); }
      if (tool.parameters !== undefined) { sets.push('parameters = ?'); params.push(JSON.stringify(tool.parameters)); }
      if (tool.handler_code !== undefined) { sets.push('handler_code = ?'); params.push(tool.handler_code); }
      if (tool.enabled !== undefined) { sets.push('enabled = ?'); params.push(tool.enabled ? 1 : 0); }
      sets.push('updated_at = ?');
      params.push(Date.now());
      params.push(id);
      run(`UPDATE tools SET ${sets.join(', ')} WHERE id = ?`, params);
      saveDb();
    }
  );

  ipcMain.handle('tools:delete', (_e, id: string) => {
    const rows = query<any>(`SELECT is_built_in FROM tools WHERE id = ?`, [id]);
    if (rows.length > 0 && rows[0].is_built_in === 1) {
      throw new Error('Cannot delete built-in tools. Use enabled toggle instead.');
    }
    run('DELETE FROM tools WHERE id = ?', [id]);
    saveDb();
  });

  ipcMain.handle('tools:execute', async (_e, toolName: string, toolArgsJson: string) => {
    const startTime = Date.now();

    // Check for custom handler code in the database
    const toolRows = query<any>(`SELECT handler_code FROM tools WHERE name = ?`, [toolName]);
    const customHandlerCode = toolRows.length > 0 ? toolRows[0].handler_code : '';

    if (customHandlerCode) {
      try {
        const args = JSON.parse(toolArgsJson);
        // Create a sandboxed execution context: args is the only parameter
        const executeHandler = new Function('args', customHandlerCode);
        const result = await executeHandler(args);
        const content = typeof result === 'string' ? result : JSON.stringify(result);
        return {
          content,
          error: undefined,
          duration_ms: Date.now() - startTime,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: '', error: `Custom handler error: ${msg}`, duration_ms: Date.now() - startTime };
      }
    }

    const handler = builtInHandlers[toolName];
    if (!handler) {
      return { content: '', error: `Unknown tool: ${toolName}`, duration_ms: Date.now() - startTime };
    }

    try {
      const args = JSON.parse(toolArgsJson);
      const result = await handler(args);
      return {
        content: result.content,
        error: result.error,
        duration_ms: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: '', error: `Tool execution error: ${msg}`, duration_ms: Date.now() - startTime };
    }
  });

  ipcMain.handle('tools:reorder', (_e, order: string[]) => {
    order.forEach((id, i) => {
      run('UPDATE tools SET sort_order = ?, updated_at = ? WHERE id = ?', [i, Date.now(), id]);
    });
    saveDb();
  });
}
