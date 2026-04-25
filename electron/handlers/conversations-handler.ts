import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { query, run, saveDb } from '../database';

export function registerConversationsHandlers(): void {
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
}
