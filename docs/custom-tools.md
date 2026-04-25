# Custom Tools

Custom tools let you define executable functions that the LLM can call during chat. Create them in **Settings → Tools**.

## Setup

| Field | Description |
|-------|-------------|
| **Name** | Unique identifier sent to the LLM (e.g. `get_current_datetime`) |
| **Description** | What the tool does — the LLM uses this to decide when to call it |
| **Parameters** | JSON Schema describing the arguments the LLM should pass |
| **Handler Code** | JavaScript function body that receives `args` and returns a string |

## Handler Code

Your handler code becomes the **body** of `function(args) { ... }`. The `args` variable is already available.

```js
return JSON.stringify({ date: new Date().toISOString() });
```

Helper function declarations are supported:

```js
function formatDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

const now = new Date();
return JSON.stringify({ 
  date: formatDate(now), 
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone 
});
```

Async is supported (`await fetch(...)`, etc.).

## JSON Schema Reference

```json
{
  "type": "object",
  "properties": {
    "arg_name": { "type": "string", "description": "Description" }
  },
  "required": ["arg_name"]
}
```

### Supported types

| Type | Example |
|------|---------|
| `string` | `{"type": "string", "description": "Query"}` |
| `number` | `{"type": "number", "description": "Page"}` |
| `boolean` | `{"type": "boolean", "description": "Enabled"}` |
| `object` | Nested `type: "object"` with its own `properties` |
| `array` | `{"type": "array", "items": { "type": "string" }}` |
| `enum` | `{"type": "string", "enum": ["a", "b", "c"]}` |

### Nested objects

```json
{
  "type": "object",
  "properties": {
    "location": {
      "type": "object",
      "properties": {
        "city": { "type": "string" },
        "country": { "type": "string" }
      },
      "required": ["city", "country"]
    }
  },
  "required": ["location"]
}
```

## How It Works

1. Tool is stored in local SQLite with its schema and handler code
2. Enabled tools are converted to OpenAI-compatible function definitions and sent with each message
3. LLM responds with a tool call containing name + arguments (guided by your JSON Schema)
4. Handler runs via `new Function('args', code)` in the main process
5. Return value (string) is sent back to the LLM

## Built-in Tools

| Name | Params |
|------|--------|
| `web_search` | `query` (string) |
| `fetch_url` | `url` (string) |

Built-in tools cannot be deleted, only toggled. Custom tools are fully editable.

## Notes

- Description drives LLM tool selection — be specific
- Return a string; use `JSON.stringify()` for structured data
- No `require()`/`import` — only standard globals and Node.js built-ins
- Empty-parameter tools still need `"type": "object", "properties": {}`
