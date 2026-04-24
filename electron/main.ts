import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import path from 'path';
import initSqlJs, { type SqlJsStatic, type Database } from 'sql.js';
import { v4 as uuidv4 } from 'uuid';

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
      enabled INTEGER NOT NULL DEFAULT 1,
      is_built_in INTEGER NOT NULL DEFAULT 0,
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

  // Web Search tool
  const webSearchDef = JSON.stringify({
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for information. Use this when the user asks a question that requires up-to-date or factual information.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to look up',
          },
        },
        required: ['query'],
      },
    },
  });

  const now = Date.now();
  const rows = query<any>(`SELECT id FROM tools WHERE name = 'web_search'`);
  if (rows.length === 0) {
    run(
      'INSERT INTO tools (id, name, description, parameters, enabled, is_built_in, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        uuidv4(),
        'web_search',
        'Search the web for information using a search engine. Returns relevant results with titles, URLs, and snippets.',
        webSearchDef,
        1,
        1,
        now,
        now,
      ]
    );
    saveDb();
  }
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
  return query<any>(
    `SELECT id, role, content, reasoning, created_at, model, input_tokens, output_tokens, reasoning_tokens, duration_ms FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`,
    [conversationId]
  );
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
    durationMs?: number
  ) => {
    const id = uuidv4();
    const now = Date.now();
    run(
      'INSERT INTO messages (id, conversation_id, role, content, reasoning, created_at, model, input_tokens, output_tokens, reasoning_tokens, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
  const rows = query<any>(`SELECT * FROM tools ORDER BY name`);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    parameters: typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters,
    enabled: row.enabled === 1,
    is_built_in: row.is_built_in === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
});

ipcMain.handle(
  'tools:create',
  (_e, tool: { name: string; description: string; parameters: Record<string, unknown>; enabled?: boolean }) => {
    const id = uuidv4();
    const now = Date.now();
    run(
      'INSERT INTO tools (id, name, description, parameters, enabled, is_built_in, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        tool.name,
        tool.description,
        JSON.stringify(tool.parameters),
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
      enabled: tool.enabled !== false,
      is_built_in: false,
      created_at: now,
      updated_at: now,
    };
  }
);

ipcMain.handle(
  'tools:update',
  (_e, id: string, tool: { name?: string; description?: string; parameters?: Record<string, unknown>; enabled?: boolean }) => {
    const sets: string[] = [];
    const params: any[] = [];
    if (tool.name !== undefined) { sets.push('name = ?'); params.push(tool.name); }
    if (tool.description !== undefined) { sets.push('description = ?'); params.push(tool.description); }
    if (tool.parameters !== undefined) { sets.push('parameters = ?'); params.push(JSON.stringify(tool.parameters)); }
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

  // Built-in tools registry
  const builtInHandlers: Record<string, (args: any) => Promise<{ content: string; error?: string }>> = {
    web_search: async (args: { query: string }) => {
      const encoded = encodeURIComponent(args.query);
      const url = `https://html.duckduckgo.com/html/?q=${encoded}`;

      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        const html = await res.text();

        const results: Array<{ title: string; url: string; snippet: string }> = [];
        const snippets = html.match(/<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<div[^>]*class="result__snippet"[^>]*>([^<]*)/g);

        if (snippets) {
          for (const block of snippets) {
            const urlMatch = block.match(/href="([^"]*)"/);
            const titleMatch = block.match(/class="result__a"[^>]*>([^<]*)/);
            const snippetMatch = block.match(/class="result__snippet"[^>]*>([^<]*)/);
            if (urlMatch && titleMatch && snippetMatch) {
              results.push({
                title: titleMatch[1].trim(),
                url: urlMatch[1],
                snippet: snippetMatch[1].trim(),
              });
            }
          }
        }

        // Fallback parser
        if (results.length === 0) {
          const links = html.match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([^<]*)<\/a>/g);
          const seen = new Set<string>();
          if (links) {
            for (const link of links) {
              const hrefMatch = link.match(/href="(https?:\/\/[^"]+)"/);
              const textMatch = link.match(/>([^<]*)<\/a>/);
              if (hrefMatch && textMatch && !hrefMatch[1].includes('duckduckgo') && !seen.has(hrefMatch[1])) {
                seen.add(hrefMatch[1]);
                results.push({ title: textMatch[1].trim(), url: hrefMatch[1], snippet: '' });
                if (results.length >= 5) break;
              }
            }
          }
        }

        const content = results.length > 0
          ? results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join('\n\n')
          : 'No results found.';
        return { content };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: '', error: `Search failed: ${msg}` };
      }
    },
  };

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
