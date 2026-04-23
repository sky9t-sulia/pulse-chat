import { app, BrowserWindow, ipcMain } from 'electron';
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
      created_at INTEGER NOT NULL,
      model TEXT,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      api_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      default_model TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
  `);

  // Save on shutdown
  app.on('before-quit', () => {
    if (!db || !SQL) return;
    const data = db.export();
    const fs = require('fs');
    fs.writeFileSync(dbPath, Buffer.from(data));
  });
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

  mainWindow.show();
}

app.whenReady().then(async () => {
  await initDatabase();
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
      `$${i + 1}`,
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
    'INSERT INTO conversations (id, title, created_at, updated_at) VALUES ($1, $2, $3, $4)',
    [id, title, now, now]
  );
  return { id, title, created_at: now, updated_at: now };
});

ipcMain.handle('conversations:delete', (_e, id: string) => {
  run('DELETE FROM conversations WHERE id = $1', [id]);
  saveDb();
});

ipcMain.handle('conversations:get', (_e, id: string) => {
  const rows = query<any>(
    `SELECT id, title, created_at, updated_at FROM conversations WHERE id = $1`,
    [id]
  );
  return rows.length > 0 ? rows[0] : undefined;
});

ipcMain.handle('conversations:updateTitle', (_e, id: string, title: string) => {
  run('UPDATE conversations SET title = $1, updated_at = $2 WHERE id = $3', [
    title,
    Date.now(),
    id,
  ]);
  saveDb();
});

// ─── Messages ────────────────────────────────────────────────

ipcMain.handle('messages:get', (_e, conversationId: string) => {
  return query<any>(
    `SELECT id, role, content, created_at, model FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
    [conversationId]
  );
});

ipcMain.handle(
  'messages:add',
  (_e, conversationId: string, role: string, content: string, model?: string) => {
    const id = uuidv4();
    const now = Date.now();
    run(
      'INSERT INTO messages (id, conversation_id, role, content, created_at, model) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, conversationId, role, content, now, model || null]
    );
    run('UPDATE conversations SET updated_at = $1 WHERE id = $2', [now, conversationId]);
    saveDb();
    return { id, role, content, created_at: now, model };
  }
);

ipcMain.handle('messages:delete', (_e, conversationId: string) => {
  run('DELETE FROM messages WHERE conversation_id = $1', [conversationId]);
  saveDb();
});

// ─── Providers ───────────────────────────────────────────────

ipcMain.handle('providers:list', () => {
  return query<any>(`SELECT * FROM providers ORDER BY name`);
});

ipcMain.handle(
  'providers:create',
  (_e, provider: { name: string; api_url: string; api_key: string; default_model: string }) => {
    const id = uuidv4();
    const now = Date.now();
    run(
      'INSERT INTO providers (id, name, api_url, api_key, default_model, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        id,
        provider.name,
        provider.api_url,
        provider.api_key,
        provider.default_model,
        now,
        now,
      ]
    );
    saveDb();
    return { ...provider, id, created_at: now, updated_at: now };
  }
);

ipcMain.handle(
  'providers:update',
  (
    _e,
    id: string,
    provider: { name: string; api_url: string; api_key: string; default_model: string }
  ) => {
    run(
      'UPDATE providers SET name = $1, api_url = $2, api_key = $3, default_model = $4, updated_at = $5 WHERE id = $6',
      [provider.name, provider.api_url, provider.api_key, provider.default_model, Date.now(), id]
    );
    saveDb();
  }
);

ipcMain.handle('providers:delete', (_e, id: string) => {
  run('DELETE FROM providers WHERE id = $1', [id]);
  saveDb();
});

ipcMain.handle('providers:get', (_e, id: string) => {
  const rows = query<any>(`SELECT * FROM providers WHERE id = $1`, [id]);
  return rows.length > 0 ? rows[0] : undefined;
});
