import { app } from 'electron';
import path from 'path';
import initSqlJs, { type Database } from 'sql.js';
import { state } from './state';

let _db: Database | null = null;

export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs();
  state.SQL = SQL;

  const dbPath = path.join(app.getPath('userData'), 'chat.db');

  let existingDb: Uint8Array | undefined;
  try {
    const fs = await import('fs');
    existingDb = new Uint8Array(fs.readFileSync(dbPath));
  } catch {
    // Database doesn't exist yet
  }

  _db = existingDb ? new SQL.Database(existingDb) : new SQL.Database();
  state.db = _db;

  _db.run(`
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
      is_error INTEGER NOT NULL DEFAULT 0,
      reasoning TEXT,
      created_at INTEGER NOT NULL,
      model TEXT,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      reasoning_tokens INTEGER DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      tool_invocations TEXT,
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
      model_info TEXT,
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

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL DEFAULT '',
      onboarding_complete INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
  `);

  // Migration: add is_error column to messages table if it doesn't exist yet
  try {
    _db!.run(`ALTER TABLE messages ADD COLUMN is_error INTEGER NOT NULL DEFAULT 0`);
  } catch {
    // Column already exists (table was created with it, or migration already ran)
  }

  // Register before-quit save
  app.on('before-quit', () => {
    saveDb();
  });
}

export function saveDb(): void {
  const db = state.db;
  const SQL = state.SQL;
  if (!db || !SQL) return;
  const data = db.export();
  const dbPath = path.join(app.getPath('userData'), 'chat.db');
  const fs = require('fs');
  fs.writeFileSync(dbPath, Buffer.from(data));
}

export function query<T = any>(sql: string, params: any[] = []): T[] {
  const db = state.db;
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

export function run(sql: string, params: any[] = []): void {
  const db = state.db;
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
}
