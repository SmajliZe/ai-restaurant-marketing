import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Mirrors the "@/*" path in tsconfig.json.
    alias: { '@': resolve(dirname(fileURLToPath(import.meta.url)), 'src') },
  },
  test: {
    // Everything under test here is server-side; no component tests yet.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
