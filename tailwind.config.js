import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light theme (kept for backwards compatibility with any remaining refs)
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
