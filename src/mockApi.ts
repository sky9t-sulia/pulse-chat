// Mock window.chatApi for browser-based development/testing
// Only runs if window.chatApi is not already defined (i.e., not in Electron)

if (!window.chatApi) {
const STORAGE_KEY = 'chat-app-mock-data';

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 11);
}

function loadDB() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  return { conversations: [], messages: {}, providers: [] };
}

function saveDB(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

const chatApi = {
  conversations: {
    async list() {
      const db = loadDB();
      return db.conversations.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    },
    async create(title) {
      const db = loadDB();
      const conv = {
        id: generateId(),
        title,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      db.conversations.push(conv);
      saveDB(db);
      return conv;
    },
    async delete(id) {
      const db = loadDB();
      db.conversations = db.conversations.filter((c) => c.id !== id);
      delete db.messages[id];
      saveDB(db);
    },
    async get(id) {
      const db = loadDB();
      return db.conversations.find((c) => c.id === id);
    },
    async updateTitle(id, title) {
      const db = loadDB();
      const conv = db.conversations.find((c) => c.id === id);
      if (conv) {
        conv.title = title;
        conv.updated_at = new Date().toISOString();
        saveDB(db);
      }
    },
  },
  messages: {
    async get(conversationId) {
      const db = loadDB();
      return (db.messages[conversationId] || []).sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );
    },
    async add(conversationId, role, content, model, reasoning, inputTokens, outputTokens, reasoningTokens, durationMs) {
      const db = loadDB();
      if (!db.messages[conversationId]) db.messages[conversationId] = [];
      const msg = {
        id: generateId(),
        conversation_id: conversationId,
        role,
        content,
        model: model || 'gpt-4o',
        reasoning,
        input_tokens: inputTokens || 0,
        output_tokens: outputTokens || 0,
        reasoning_tokens: reasoningTokens || 0,
        duration_ms: durationMs || 0,
        created_at: new Date().toISOString(),
      };
      db.messages[conversationId].push(msg);
      saveDB(db);
      return msg;
    },
    async delete(conversationId) {
      const db = loadDB();
      db.messages[conversationId] = [];
      saveDB(db);
    },
    async deleteOne(id: string) {
      const db = loadDB();
      for (const convId of Object.keys(db.messages)) {
        db.messages[convId] = db.messages[convId].filter((m: { id: string }) => m.id !== id);
      }
      saveDB(db);
    },
  },
  providers: {
    async list() {
      const db = loadDB();
      return db.providers;
    },
    async create(provider) {
      const db = loadDB();
      const p = {
        ...provider,
        id: generateId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      db.providers.push(p);
      saveDB(db);
      return p;
    },
    async update(id, provider) {
      const db = loadDB();
      const p = db.providers.find((p) => p.id === id);
      if (p) Object.assign(p, provider, { updated_at: new Date().toISOString() });
      saveDB(db);
    },
    async delete(id) {
      const db = loadDB();
      db.providers = db.providers.filter((p) => p.id !== id);
      saveDB(db);
    },
    async get(id) {
      const db = loadDB();
      return db.providers.find((p) => p.id === id);
    },
  },
};

window.chatApi = chatApi;
}
