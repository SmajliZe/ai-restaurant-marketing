import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Only component tests (*.test.tsx) exercise JSX; everything else is plain
  // TS run under Node, which needs no transform this plugin adds.
  plugins: [react()],
  resolve: {
    // Mirrors the "@/*" and "~/*" paths in tsconfig.json.
    alias: {
      '@': resolve(dirname(fileURLToPath(import.meta.url)), 'src'),
      '~': resolve(dirname(fileURLToPath(import.meta.url))),
    },
  },
  test: {
    // Most tests here are server-side and run under 'node'. Component tests
    // (*.test.tsx) opt into a DOM environment individually with a
    // `// @vitest-environment happy-dom` comment at the top of the file, so
    // the fast default stays untouched for everything else.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
