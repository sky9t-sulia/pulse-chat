import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { query, run, saveDb } from '../database';

export function registerProvidersHandlers(): void {
  ipcMain.handle('providers:list', () => {
    const rows = query<any>(`SELECT * FROM providers ORDER BY name`);
    return rows.map((row) => ({
      ...row,
      models: typeof row.models === 'string' ? JSON.parse(row.models) : row.models,
      model_info: row.model_info ? JSON.parse(row.model_info) : null,
    }));
  });

  ipcMain.handle(
    'providers:create',
    (
      _e,
      provider: {
        name: string;
        api_url: string;
        api_key: string;
        api_type: string;
        endpoint: string;
        default_model: string;
        models: any[];
        model_info?: Record<string, unknown> | null;
      }
    ) => {
      const id = uuidv4();
      const now = Date.now();
      run(
        'INSERT INTO providers (id, name, api_url, api_key, api_type, endpoint, default_model, models, model_info, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          id,
          provider.name,
          provider.api_url,
          provider.api_key,
          provider.api_type,
          provider.endpoint,
          provider.default_model,
          JSON.stringify(provider.models || []),
          provider.model_info ? JSON.stringify(provider.model_info) : null,
          now,
          now,
        ]
      );
      saveDb();
      return {
        ...provider,
        id,
        models: provider.models || [],
        created_at: now,
        updated_at: now,
      };
    }
  );

  ipcMain.handle(
    'providers:update',
    (
      _e,
      id: string,
      provider: {
        name?: string;
        api_url?: string;
        api_key?: string;
        api_type?: string;
        endpoint?: string;
        default_model?: string;
        models?: any[];
        model_info?: Record<string, unknown> | null;
      }
    ) => {
      const sets: string[] = [];
      const params: any[] = [];
      if (provider.name !== undefined) { sets.push('name = ?'); params.push(provider.name); }
      if (provider.api_url !== undefined) { sets.push('api_url = ?'); params.push(provider.api_url); }
      if (provider.api_key !== undefined) { sets.push('api_key = ?'); params.push(provider.api_key); }
      if (provider.api_type !== undefined) { sets.push('api_type = ?'); params.push(provider.api_type); }
      if (provider.endpoint !== undefined) { sets.push('endpoint = ?'); params.push(provider.endpoint); }
      if (provider.default_model !== undefined) { sets.push('default_model = ?'); params.push(provider.default_model); }
      if (provider.models !== undefined) { sets.push('models = ?'); params.push(JSON.stringify(provider.models)); }
      if (provider.model_info !== undefined) { sets.push('model_info = ?'); params.push(provider.model_info ? JSON.stringify(provider.model_info) : null); }
      sets.push('updated_at = ?');
      params.push(Date.now());
      params.push(id);
      run(`UPDATE providers SET ${sets.join(', ')} WHERE id = ?`, params);
      saveDb();
    }
  );

  ipcMain.handle('providers:delete', (_e, id: string) => {
    run('DELETE FROM providers WHERE id = ?', [id]);
    saveDb();
  });

  ipcMain.handle('providers:get', (_e, id: string) => {
    const rows = query<any>(`SELECT * FROM providers WHERE id = ?`, [id]);
    if (rows.length === 0) return undefined;
    return {
      ...rows[0],
      models: typeof rows[0].models === 'string' ? JSON.parse(rows[0].models) : rows[0].models,
      model_info: rows[0].model_info ? JSON.parse(rows[0].model_info) : null,
    };
  });
}
