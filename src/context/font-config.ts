import type { ChatFontFamily } from '../types/types';

export const CHAT_FONT_STACKS: Record<ChatFontFamily, string> = {
  system: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
  sans: `Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
  serif: `'Noto Serif', Georgia, Cambria, 'Times New Roman', Times, serif`,
  mono: `'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace`,
  inter: `Inter, system-ui, -apple-system, sans-serif`,
};

export const CHAT_FONT_SIZE_STEPS = [12, 13, 14, 15, 16, 17, 18, 19, 20] as const;
