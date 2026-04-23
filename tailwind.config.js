import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // claude.ai-inspired dark theme
        sidebar: '#121212',
        'sidebar-hover': '#1e1e1e',
        'sidebar-active': '#2a2a2a',
        main: '#1a1a1a',
        'main-hover': '#252525',
        input: '#2c2c2c',
        'input-focus': '#3a3a3a',
        border: '#2a2a2a',
        'border-light': '#333333',
        // Light theme
        'sidebar-light': '#f5f5f5',
        'sidebar-light-hover': '#e8e8e8',
        'main-light': '#ffffff',
        'input-light': '#f0f0f0',
        'border-light-theme': '#e0e0e0',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      fontSize: {
        'chat-text': ['15px', '24px'],
      },
      maxWidth: {
        'chat-max': '720px',
      },
    },
  },
  plugins: [],
} satisfies Config;
