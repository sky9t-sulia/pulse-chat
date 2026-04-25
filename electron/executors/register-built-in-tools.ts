import { v4 as uuidv4 } from 'uuid';
import { query, run, saveDb } from '../database';

/**
 * Seeds built-in tools (web_search, fetch_url) into the tools table.
 * Updates parameters if they've changed; skips if already present.
 */
export async function registerBuiltInTools(): Promise<void> {
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
