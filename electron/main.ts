import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import path from 'path';
import initSqlJs, { type SqlJsStatic, type Database } from 'sql.js';
import { v4 as uuidv4 } from 'uuid';
import { builtInHandlers } from './builtInTools';

let mainWindow: BrowserWindow | null = null;
let db: Database | null = null;
let SQL: SqlJsStatic | null = null;

async function initDatabase() {
  SQL = await initSqlJs();
  const dbPath = path.join(app.getPath('userData'), 'chat.db');

  let existingDb: Uint8Array | undefined;
  try {
    const fs = await import('fs');
    existingDb = new Uint8Array(fs.readFileSync(dbPath));
  } catch {
    // Database doesn't exist yet
  }

  db = existingDb ? new SQL.Database(existingDb) : new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      reasoning TEXT,
      created_at INTEGER NOT NULL,
      model TEXT,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      api_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      api_type TEXT NOT NULL DEFAULT 'openai',
      endpoint TEXT NOT NULL DEFAULT '/v1/chat/completions',
      default_model TEXT NOT NULL,
      models TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      parameters TEXT NOT NULL DEFAULT '{}',
      handler_code TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      is_built_in INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
  `);

  // Migration: add reasoning column if it doesn't exist yet
  try {
    db.run(`ALTER TABLE messages ADD COLUMN reasoning TEXT`);
  } catch {
    // Column already exists or migration not needed
  }

  // Migration: add model_info column if it doesn't exist yet
  try {
    db.run(`ALTER TABLE providers ADD COLUMN model_info TEXT`);
  } catch {
    // Column already exists or migration not needed
  }

  // Migration: add api_type column if it doesn't exist yet
  try {
    db.run(`ALTER TABLE providers ADD COLUMN api_type TEXT NOT NULL DEFAULT 'openai'`);
  } catch {
    // Column already exists or migration not needed
  }

  // Migration: add endpoint column if it doesn't exist yet
  try {
    db.run(`ALTER TABLE providers ADD COLUMN endpoint TEXT NOT NULL DEFAULT '/v1/chat/completions'`);
  } catch {
    // Column already exists or migration not needed
  }

  // Migration: add models column if it doesn't exist yet
  try {
    db.run(`ALTER TABLE providers ADD COLUMN models TEXT NOT NULL DEFAULT '[]'`);
  } catch {
    // Column already exists or migration not needed
  }

  // Migration: add token count columns if they don't exist yet
  try {
    db.run(`ALTER TABLE messages ADD COLUMN input_tokens INTEGER DEFAULT 0`);
  } catch {
    // Column already exists or migration not needed
  }
  try {
    db.run(`ALTER TABLE messages ADD COLUMN output_tokens INTEGER DEFAULT 0`);
  } catch {
    // Column already exists or migration not needed
  }
  try {
    db.run(`ALTER TABLE messages ADD COLUMN reasoning_tokens INTEGER DEFAULT 0`);
  } catch {
    // Column already exists or migration not needed
  }
  try {
    db.run(`ALTER TABLE messages ADD COLUMN duration_ms INTEGER DEFAULT 0`);
  } catch {
    // Column already exists or migration not needed
  }

  // Migration: add tool_invocations column (JSON) if it doesn't exist yet
  try {
    db.run(`ALTER TABLE messages ADD COLUMN tool_invocations TEXT`);
  } catch {
    // Column already exists or migration not needed
  }

  // Migration: add handler_code column to tools if it doesn't exist yet
  try {
    db.run(`ALTER TABLE tools ADD COLUMN handler_code TEXT NOT NULL DEFAULT ''`);
  } catch {
    // Column already exists or migration not needed
  }

  // Migration: add sort_order column to tools if it doesn't exist yet
  try {
    db.run(`ALTER TABLE tools ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);
    // Assign existing tools sequential sort_order values
    const existing = query<any>(`SELECT id FROM tools ORDER BY created_at`);
    existing.forEach((row, i) => {
      run(`UPDATE tools SET sort_order = ? WHERE id = ?`, [i, row.id]);
    });
  } catch {
    // Column already exists or migration not needed
  }

  // Save on shutdown
  app.on('before-quit', () => {
    if (!db || !SQL) return;
    const data = db.export();
    const fs = require('fs');
    fs.writeFileSync(dbPath, Buffer.from(data));
  });
}

async function registerBuiltInTools() {
  if (!db || !SQL) return;

  // JSON Schemas for built-in tool parameters.
  // The DB column stores ONLY the schema; the `{type:'function', function:{...}}`
  // wrapper is added by the client when building the request body.
  const builtIns: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> = [
    {
      name: 'web_search',
      description:
        'Search the web for information using a search engine. Returns relevant results with titles, URLs, and snippets.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query to look up' },
        },
        required: ['query'],
      },
    },
    {
      name: 'fetch_url',
      description:
        'Fetch the text content of a web page by URL. Use this after web_search to read full page content when snippets are not enough (e.g. to get live data, specific numbers, or detailed information).',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The absolute http(s) URL to fetch' },
        },
        required: ['url'],
      },
    },
  ];

  const now = Date.now();
  for (const tool of builtIns) {
    const paramsJson = JSON.stringify(tool.parameters);
    const rows = query<any>(`SELECT id, parameters FROM tools WHERE name = ?`, [tool.name]);
    if (rows.length === 0) {
      run(
        'INSERT INTO tools (id, name, description, parameters, enabled, is_built_in, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), tool.name, tool.description, paramsJson, 1, 1, now, now]
      );
      continue;
    }
    let parsed: any = null;
    try {
      parsed = typeof rows[0].parameters === 'string'
        ? JSON.parse(rows[0].parameters)
        : rows[0].parameters;
    } catch {
      parsed = null;
    }
    if (!parsed || parsed.type !== 'object') {
      run(
        'UPDATE tools SET parameters = ?, description = ?, updated_at = ? WHERE id = ?',
        [paramsJson, tool.description, now, rows[0].id]
      );
    }
  }
  saveDb();
}

function saveDb() {
  if (!db || !SQL) return;
  const data = db.export();
  const dbPath = path.join(app.getPath('userData'), 'chat.db');
  const fs = require('fs');
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1a1a1a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Disable right-click context menu
  mainWindow.webContents.on('context-menu', () => {
    // No-op: blocks the default context menu
  });

  mainWindow.show();
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  await initDatabase();
  await registerBuiltInTools();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ─── Helpers ─────────────────────────────────────────────────

function query<T = any>(sql: string, params: any[] = []): T[] {
  if (!db) throw new Error('Database not initialized');

  let modifiedSql = sql;
  params.forEach((param, i) => {
    modifiedSql = modifiedSql.replace(
      '?',
      typeof param === 'string' ? `'${param.replace(/'/g, "''")}'` : String(param)
    );
  });

  const result = db.exec(modifiedSql);
  if (result.length === 0) return [];

  const { columns, values } = result[0];
  return values.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  ) as T[];
}

function run(sql: string, params: any[] = []) {
  if (!db) throw new Error('Database not initialized');
  // sql.js uses ? placeholders with a parameter array
  db.run(sql, params);
}

// ─── Conversations ───────────────────────────────────────────

ipcMain.handle('conversations:list', () => {
  return query<any>(
    `SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC`
  );
});

ipcMain.handle('conversations:create', (_e, title: string) => {
  const id = uuidv4();
  const now = Date.now();
  run(
    'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [id, title, now, now]
  );
  return { id, title, created_at: now, updated_at: now };
});

ipcMain.handle('conversations:delete', (_e, id: string) => {
  run('DELETE FROM conversations WHERE id = ?', [id]);
  saveDb();
});

ipcMain.handle('conversations:get', (_e, id: string) => {
  const rows = query<any>(
    `SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?`,
    [id]
  );
  return rows.length > 0 ? rows[0] : undefined;
});

ipcMain.handle('conversations:updateTitle', (_e, id: string, title: string) => {
  run('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?', [
    title,
    Date.now(),
    id,
  ]);
  saveDb();
});

// ─── Messages ────────────────────────────────────────────────

ipcMain.handle('messages:get', (_e, conversationId: string) => {
  const rows = query<any>(
    `SELECT id, role, content, reasoning, created_at, model, input_tokens, output_tokens, reasoning_tokens, duration_ms, tool_invocations FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`,
    [conversationId]
  );
  return rows.map((row) => ({
    ...row,
    tool_invocations: row.tool_invocations ? JSON.parse(row.tool_invocations) : null,
  }));
});

ipcMain.handle(
  'messages:add',
  (
    _e,
    conversationId: string,
    role: string,
    content: string,
    model?: string,
    reasoning?: string,
    inputTokens?: number,
    outputTokens?: number,
    reasoningTokens?: number,
    durationMs?: number,
    toolInvocations?: unknown[] | null
  ) => {
    const id = uuidv4();
    const now = Date.now();
    const toolInvocationsJson =
      toolInvocations && toolInvocations.length > 0 ? JSON.stringify(toolInvocations) : null;
    run(
      'INSERT INTO messages (id, conversation_id, role, content, reasoning, created_at, model, input_tokens, output_tokens, reasoning_tokens, duration_ms, tool_invocations) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        conversationId,
        role,
        content,
        reasoning || null,
        now,
        model || null,
        inputTokens || 0,
        outputTokens || 0,
        reasoningTokens || 0,
        durationMs || 0,
        toolInvocationsJson,
      ]
    );
    run('UPDATE conversations SET updated_at = ? WHERE id = ?', [now, conversationId]);
    saveDb();
    return {
      id,
      role,
      content,
      reasoning,
      created_at: now,
      model,
      input_tokens: inputTokens || 0,
      output_tokens: outputTokens || 0,
      reasoning_tokens: reasoningTokens || 0,
      duration_ms: durationMs || 0,
      tool_invocations: toolInvocations && toolInvocations.length > 0 ? toolInvocations : null,
    };
  }
);

ipcMain.handle('messages:delete', (_e, conversationId: string) => {
  run('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
  saveDb();
});

ipcMain.handle('messages:deleteOne', (_e, id: string) => {
  run('DELETE FROM messages WHERE id = ?', [id]);
  saveDb();
});

// ─── Providers ───────────────────────────────────────────────

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

// ─── Tools ───────────────────────────────────────────────────

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
