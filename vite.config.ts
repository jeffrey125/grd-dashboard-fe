import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

import { parsePublicConfig } from './src/lib/public-config.ts';

export default defineConfig(({ mode }) => {
  parsePublicConfig(loadEnv(mode, process.cwd(), 'VITE_'));

  return {
    plugins: [tanstackRouter({ autoCodeSplitting: true }), react()],
    resolve: {
      tsconfigPaths: true,
    },
    server: {
      host: 'localhost',
      port: 5173,
      strictPort: true,
    },
    preview: {
      host: 'localhost',
      port: 4173,
      strictPort: true,
    },
  };
});
