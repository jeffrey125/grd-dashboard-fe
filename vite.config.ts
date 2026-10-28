import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

import { parsePublicConfig } from './src/lib/public-config.ts';

export default defineConfig(({ mode }) => {
  const config = parsePublicConfig(loadEnv(mode, process.cwd(), 'VITE_'));

  let release = process.env.BUILD_COMMIT;
  if (!release) {
    try {
      release = execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      release = 'development';
    }
  }
  if (!/^(?:[a-f0-9]{40}|development)$/.test(release)) throw new Error('Invalid build release');

  return {
    define: { __GRD_RELEASE__: JSON.stringify(release) },
    build: { sourcemap: 'hidden' as const },
    plugins: [
      tanstackRouter({ autoCodeSplitting: true }),
      react(),
      {
        name: 'private-source-maps',
        generateBundle(_options, bundle) {
          for (const [name, asset] of Object.entries(bundle)) {
            if (asset.type !== 'asset' || !name.endsWith('.map')) continue;
            const destination = join('.private-source-maps', release, name);
            mkdirSync(dirname(destination), { recursive: true });
            writeFileSync(destination, asset.source);
            delete bundle[name];
          }
        },
      },
    ],
    resolve: {
      tsconfigPaths: true,
    },
    server: {
      host: 'localhost',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api/v1': {
          target: config.apiOrigin,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: 'localhost',
      port: 4173,
      strictPort: true,
    },
  };
});
