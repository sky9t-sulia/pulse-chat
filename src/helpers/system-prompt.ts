// Hidden base system prompt — prepended to the user-provided system prompt.
// Tells the model how to format output so it renders correctly in the UI.
export const BASE_SYSTEM_PROMPT = [
  'Formatting rules for all responses:',
  '- Use GitHub-flavored markdown for headings, lists, tables, and fenced code blocks.',
  '- For code, use fenced blocks with a language tag (```python, ```ts, …). Do not wrap prose in code fences.',
  '- Keep answers concise by default; expand only when the user asks for detail.',
].join('\n');

export interface UserContext {
  name: string;
  gender: string;
  bio: string;
}

export function composeSystemPrompt(userPrompt: string, userContext?: UserContext): string {
  const parts = [BASE_SYSTEM_PROMPT];

  if (userContext && (userContext.name || userContext.gender || userContext.bio)) {
    const contextLines: string[] = ['Knowledge about the user:'];
    if (userContext.name) contextLines.push(`- Their name is ${userContext.name}.`);
    if (userContext.gender) contextLines.push(`- Their gender is ${userContext.gender}.`);
    if (userContext.bio) contextLines.push(`- About them: ${userContext.bio}`);
    parts.push(contextLines.join('\n'));
  }

  const trimmed = userPrompt?.trim();
  if (trimmed) {
    parts.push(trimmed);
  }

  return parts.filter(Boolean).join('\n\n---\n\n');
}
