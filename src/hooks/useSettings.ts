import { useState, useEffect, useCallback } from 'react';
import type { ThemeMode, ChatSettings } from '../types/types';
import { CHAT_FONT_STACKS, CHAT_FONT_SIZE_STEPS } from '../context/font-config';

const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  system_prompt: '',
  font_family: 'system',
  font_size: 16,
  max_calls_per_tool: 3,
};

export function loadChatSettings(): ChatSettings {
  try {
    const raw = localStorage.getItem('chat-settings');
    if (!raw) return DEFAULT_CHAT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      system_prompt: typeof parsed.system_prompt === 'string' ? parsed.system_prompt : '',
      font_family:
        parsed.font_family === 'inter'
          ? 'sans'
          : CHAT_FONT_STACKS[parsed.font_family as keyof typeof CHAT_FONT_STACKS]
            ? (parsed.font_family as keyof typeof CHAT_FONT_STACKS)
            : 'system',
      font_size:
        typeof parsed.font_size === 'number' &&
        (CHAT_FONT_SIZE_STEPS as readonly number[]).includes(parsed.font_size)
          ? parsed.font_size
          : 16,
      max_calls_per_tool:
        typeof parsed.max_calls_per_tool === 'number' &&
        parsed.max_calls_per_tool >= 1 &&
        parsed.max_calls_per_tool <= 20
          ? Math.floor(parsed.max_calls_per_tool)
          : 3,
    };
  } catch {
    return DEFAULT_CHAT_SETTINGS;
  }
}

export function useSettings() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('chat-theme');
    return (saved as ThemeMode) || 'dark';
  });
  const [chatSettings, setChatSettingsState] = useState<ChatSettings>(loadChatSettings);

  useEffect(() => {
    localStorage.setItem('chat-theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('chat-settings', JSON.stringify(chatSettings));
    const root = document.documentElement;
    root.style.setProperty('--chat-font-family', CHAT_FONT_STACKS[chatSettings.font_family]);
    root.style.setProperty('--chat-font-size', `${chatSettings.font_size}px`);
  }, [chatSettings]);

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
  }, []);

  const setChatSettings = useCallback((s: ChatSettings) => {
    setChatSettingsState(s);
  }, []);

  return { theme, setTheme, chatSettings, setChatSettings };
}
