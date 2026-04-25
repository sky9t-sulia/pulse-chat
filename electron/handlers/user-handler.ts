import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { query, run, saveDb } from '../database';

export function registerUserHandlers(): void {
  ipcMain.handle('user:get', () => {
    const rows = query<any>(`SELECT * FROM users LIMIT 1`);
    if (rows.length > 0) {
      const row = rows[0];
      return {
        id: row.id,
        name: row.name || '',
        bio: row.bio || '',
        gender: row.gender || '',
        onboardingComplete: row.onboarding_complete === 1,
      };
    }
    return {
      id: null,
      name: '',
      bio: '',
      gender: '',
      onboardingComplete: false,
    };
  });

  ipcMain.handle(
    'user:update',
    (_e, user: { name: string; bio: string; gender: string }) => {
      const rows = query<any>(`SELECT id FROM users LIMIT 1`);
      const now = Date.now();
      if (rows.length > 0) {
        run(
          'UPDATE users SET name = ?, bio = ?, gender = ?, onboarding_complete = 1, updated_at = ? WHERE id = ?',
          [user.name, user.bio, user.gender, now, rows[0].id]
        );
      } else {
        const id = uuidv4();
        run(
          'INSERT INTO users (id, name, bio, gender, onboarding_complete, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
          [id, user.name, user.bio, user.gender, now, now]
        );
      }
      saveDb();
    }
  );
}
