import type { BrowserWindow } from 'electron';
import type { Database, SqlJsStatic } from 'sql.js';

let _mainWindow: BrowserWindow | null = null;
let _db: Database | null = null;
let _SQL: SqlJsStatic | null = null;

export const state = {
  get mainWindow() { return _mainWindow; },
  get db() { return _db; },
  get SQL() { return _SQL; },
  set mainWindow(v: BrowserWindow | null) { _mainWindow = v; },
  set db(v: Database | null) { _db = v; },
  set SQL(v: SqlJsStatic | null) { _SQL = v; },
};
