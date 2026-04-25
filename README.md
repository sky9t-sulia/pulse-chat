# Pulse

**A local-first LLM desktop chat app.**

Pulse is a fast, elegant desktop chat application for interacting with large language models through OpenAI-compatible APIs. It runs entirely on your machine with all conversations, provider configurations, and custom tools stored locally in SQLite — no cloud dependency required.

Whether you're connecting to a local Ollama instance, an OpenRouter gateway, or any OpenAI-compatible endpoint, Pulse gives you a clean, distraction-free interface with powerful features like streaming responses, custom tool execution, and reasoning/thinking block support.

---

## Key Features

- **Local-first architecture** — All data stored in a local SQLite database. Conversations, messages, provider configs, and tools never leave your machine.
- **OpenAI-compatible API support** — Connect to any OpenAI-compatible endpoint: local servers (Ollama, LM Studio, llama.cpp), OpenRouter, Together AI, and more.
- **Streaming responses** — Real-time token-by-token streaming with live rendering.
- **Tool/function calling** — The LLM can call tools during chat. Comes with built-in `web_search` (DuckDuckGo) and `fetch_url` tools, plus the ability to create custom tools with arbitrary JavaScript handlers.
- **Reasoning/thinking block support** — Collapsible reasoning blocks for models that output chain-of-thought or `<thinking>` tags.
- **Custom tools** — Define your own tools with JavaScript handlers. Execute arbitrary code, search the web, fetch URLs, or integrate with any API.
- **Dark & light themes** — Carefully crafted themes that adapt to your preference.
- **Font customization** — Choose from serif, sans-serif, or monospace fonts with adjustable sizes.
- **Privacy-first** — Your conversations and API keys stay on your machine. Nothing is uploaded to any third-party service.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build tool | Vite 6 |
| Desktop wrapper | Electron 33 |
| Styling | Tailwind CSS 3 |
| Database | sql.js (SQLite in the browser) |
| Markdown rendering | react-markdown + rehype-katex + remark-math |
| Syntax highlighting | react-syntax-highlighter |
| Icons | Lucide React |
| Fonts | Fontsource (Inter, JetBrains Mono, Noto Serif) |
| Packaging | electron-builder |

---

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ and npm

### Setup

```bash
# Clone the repository
git clone https://github.com/suleiman/pulse.git
cd pulse

# Install dependencies
npm install

# Start development server
npm run dev
```

This starts Vite, TypeScript watch, and Electron simultaneously. The app should open automatically.

### Building

```bash
# Type-check only
npm run typecheck

# Build for web (static assets)
npm run build:web

# Build desktop app
npm run build          # General build
npm run build:macos    # macOS DMG
npm run build:linux    # Linux AppImage
npm run build:windows  # Windows installer
```

Built files go into `dist/` (web) or `release/` (desktop packages).

---

## Usage

### Adding a Provider

1. Click **Settings** in the sidebar.
2. Go to the **LM Providers** tab.
3. Click **Add Provider**.
4. Enter a name, API base URL, and API key.
5. Save — the provider will appear in the provider selector.

### Starting a Chat

1. Select a provider from the dropdown in the sidebar.
2. Type a message and press Enter.
3. Responses stream in real-time with markdown and LaTeX rendering.

### Using Tools

- Built-in tools (`web_search`, `fetch_url`) can be toggled on/off in the **Tools** tab.
- Custom tools can be created with the **Add Tool** button — define a name, description, JSON schema parameters, and a JavaScript handler function.
- Enabled tools are available to the model during chat and can be called automatically.

### Customizing Settings

- **Chat Settings**: Adjust system prompt, font family, font size, and max tool calls per message.
- **Profile**: Configure your user identity and message style.

---

## License

Licensed under the [GNU GPLv2](LICENSE) license.
