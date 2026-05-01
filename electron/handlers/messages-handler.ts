import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { query, run, saveDb } from '../database';

export function registerMessagesHandlers(): void {
  ipcMain.handle('messages:get', (_e, conversationId: string) => {
    const rows = query<any>(
      `SELECT id, role, content, is_error, reasoning, created_at, model, input_tokens, output_tokens, reasoning_tokens, duration_ms, tool_invocations FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`,
      [conversationId]
    );
    return rows.map((row) => ({
      ...row,
      is_error: !!row.is_error,
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
      toolInvocations?: unknown[] | null,
      isError?: boolean
    ) => {
      const id = uuidv4();
      const now = Date.now();
      const toolInvocationsJson =
        toolInvocations && toolInvocations.length > 0 ? JSON.stringify(toolInvocations) : null;
      run(
        'INSERT INTO messages (id, conversation_id, role, content, is_error, reasoning, created_at, model, input_tokens, output_tokens, reasoning_tokens, duration_ms, tool_invocations) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          id,
          conversationId,
          role,
          content,
          isError ? 1 : 0,
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
        is_error: !!isError,
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
}
