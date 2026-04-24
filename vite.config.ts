import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import packageJson from './package.json';

export default defineConfig({
  plugins: [
    react(),
    // Replace __PACKAGE_NAME__ in index.html at build time
    {
      name: 'inject-html-env',
      transformIndexHtml(html) {
        return html.replace('__PACKAGE_NAME__', packageJson.displayName || packageJson.name);
      },
    },
  ],
  base: './',
  define: {
    'import.meta.env.PACKAGE_VERSION': JSON.stringify(packageJson.version),
    'import.meta.env.PACKAGE_NAME': JSON.stringify(packageJson.displayName || packageJson.name),
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
  },
});
