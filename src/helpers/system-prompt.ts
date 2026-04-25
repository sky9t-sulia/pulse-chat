// Hidden base system prompt — prepended to the user-provided system prompt.
// Tells the model how to format output so it renders correctly in the UI.
export const BASE_SYSTEM_PROMPT = [
  'Formatting rules for all responses:',
  '- Use GitHub-flavored markdown for headings, lists, tables, and fenced code blocks.',
  '- For code, use fenced blocks with a language tag (```python, ```ts, …). Do not wrap prose in code fences.',
  '- Keep answers concise by default; expand only when the user asks for detail.',
].join('\n');

export function composeSystemPrompt(userPrompt: string): string {
  const trimmed = userPrompt.trim();
  if (!trimmed) return BASE_SYSTEM_PROMPT;
  return `${BASE_SYSTEM_PROMPT}\n\n---\n\n${trimmed}`;
}
