# Pulse — Context for Qwen Code

## Project Overview

**Pulse** is a local-first, desktop LLM chat application built with React + TypeScript (frontend) and Electron (desktop wrapper). It connects to any OpenAI-compatible API (local Ollama, LM Studio, OpenRouter, etc.) and stores all data — conversations, messages, provider configs, and custom tools — in a local SQLite database (via sql.js). No cloud dependency.

### Key features
- Streaming token-by-token responses with markdown + LaTeX rendering
- Tool/function calling (built-in: `web_search` via DuckDuckGo, `fetch_url` with SSRF protection; plus custom JS tool handlers)
- Collapsible reasoning/thinking blocks (`<thinking>` tags)
- Dark/light themes, font customization (serif, sans, mono)
- Privacy-first: everything stays on the machine

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript |
| Build | Vite 6 |
| Desktop | Electron 33 + electron-builder |
| Styling | Tailwind CSS 3 (custom dark/light themes) |
| Database | sql.js (SQLite, saved to `app.getPath('userData')/chat.db`) |
| Markdown | react-markdown + rehype-katex + remark-math + remark-gfm |
| Syntax highlighting | react-syntax-highlighter (Prism) |
| Icons | Lucide React |
| Fonts | Fontsource (Inter, JetBrains Mono, Noto Serif) |

## Project Structure

```
chat/
├── src/                          # React frontend
│   ├── App.tsx                   # Root component (sidebar + chat/settings)
│   ├── main.tsx                  # Entry point
│   ├── index.css                 # Global styles + Tailwind imports
│   ├── components/               # UI components
│   │   ├── ChatArea/             # Message display, streaming, tool invocations
│   │   ├── ChatInput/            # Message input with token stats
│   │   ├── Settings/             # Settings pages (providers, tools, chat, profile)
│   │   ├── Sidebar/              # Conversation list, provider selector
│   │   └── FormInputs.tsx        # Shared form input components
│   ├── context/                  # React contexts
│   │   ├── AppContext.tsx        # Main app state (conversations, messages, providers)
│   │   ├── tools.tsx             # Tool registry (list, create, delete, execute)
│   │   ├── providers.ts          # Provider context (model selection)
│   │   └── font-config.ts        # Font configuration helpers
│   ├── hooks/                    # Custom React hooks
│   │   ├── useChat.ts            # Chat orchestration (send, stop, resend, regenerate)
│   │   ├── useChat/              # Chat sub-modules
│   │   │   ├── sendMessage.ts    # Builds request body, sends to API
│   │   │   ├── streaming.ts      # SSE streaming parser
│   │   │   ├── executeToolCalls.ts # Tool execution during streaming
│   │   │   ├── saveFinalMessage.ts # Persists final message to DB
│   │   │   └── resendOrRegenerate.ts
│   │   ├── useConversations.ts
│   │   ├── useMessages.ts
│   │   ├── useProviders.ts
│   │   ├── useSettings.ts
│   │   ├── useUserSettings.ts
│   │   ├── useChatInput.ts
│   │   └── useProviderForm.ts
│   ├── helpers/                  # Utility functions
│   │   └── url.ts                # URL helpers (getFullChatUrl, etc.)
│   ├── types/                    # TypeScript types
│   │   ├── types.ts              # Domain types (Conversation, Message, Provider, Tool, etc.)
│   │   └── streaming-api.ts      # Streaming types (LoadingPhase, TokenStats, ToolInvocation)
│   └── vite-env.d.ts
├── electron/                     # Electron main process
│   ├── main.ts                   # App bootstrap, window creation, IPC registration
│   ├── preload.ts                # contextBridge → window.chatApi
│   ├── state.ts                  # Global state (db, SQL instance, mainWindow)
│   ├── database.ts               # SQLite init, schema, query/run helpers
│   ├── handlers/                 # IPC handlers (one file per domain)
│   │   ├── conversations-handler.ts
│   │   ├── messages-handler.ts
│   │   ├── providers-handler.ts
│   │   ├── tools-handler.ts
│   │   └── user-handler.ts
│   └── executors/
│       └── register-built-in-tools.ts  # Seeds web_search + fetch_url into DB
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json / tsconfig.node.json / tsconfig.electron.json
└── package.json
```

## Building and Running

```bash
# Install dependencies
npm install

# Development (Vite + TypeScript watch + Electron, all in one)
npm run dev

# Type-check only
npm run typecheck

# Build static web assets
npm run build:web

# Build desktop app
npm run build              # General build
npm run build:linux        # Linux AppImage
npm run build:macos        # macOS DMG
npm run build:windows      # Windows installer
```

## Architecture Notes

### Database
- SQLite via sql.js, stored at `$userData/chat.db`
- Schema: `conversations`, `messages`, `providers`, `tools`, `users` tables
- Data auto-saved on `before-quit`
- `query()` and `run()` helpers in `electron/database.ts` (parameterized via `?` placeholders with manual escaping)

### IPC layer
- Frontend calls `window.chatApi.*` (exposed via preload contextBridge)
- `electron/handlers/` files register `ipcMain.handle()` handlers
- No Zod validation on the IPC layer — raw params passed through

### Tool system
- **Built-in tools** (`web_search`, `fetch_url`) are seeded on app startup
- **Custom tools** — users define name, description, JSON Schema parameters, and a JS handler
- Handlers run via `new Function('args', code)` in the Electron main process
- Tool definitions are sent to the LLM API in OpenAI-compatible `{"type": "function", "function": {...}}` format
- During streaming, `executeToolCalls.ts` executes tool handlers via IPC and injects results back

### Streaming
- SSE-based streaming from the API
- `LoadingPhase` states: `idle`, `waiting`, `sending`, `loading`, `done`, `error`
- Token stats (input/output/reasoning tokens, duration) tracked and displayed
- Auto-scroll when near bottom of chat

### Path aliases
- `@/*` → `./src/*` (configured in tsconfig.json)

### Type organization
- `src/types/types.ts` — domain/model types (`Conversation`, `Message`, `Provider`, `Tool`, `ChatSession`, `ChatAPI`, etc.)
- `src/types/streaming-api.ts` — streaming/transport-layer types (`LoadingPhase`, `TokenStats`, `ApiMessage`, `StreamingCallbacks`, `ToolInvocation`)

## Development Conventions

- **Strict TypeScript** — `strict: true`, `noUnusedLocals`, `noUnusedParameters`
- **No bundling of Electron code** — Electron source is compiled separately via `tsconfig.electron.json`
- **Concurrently** runs Vite, TypeScript watch, and Electron in dev mode
- **No right-click context menu** in the Electron window (disabled in `main.ts`)
- **Local-first** — no analytics, no telemetry, no cloud sync
