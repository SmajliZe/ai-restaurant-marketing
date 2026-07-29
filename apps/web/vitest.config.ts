import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Everything under test here is server-side; no component tests yet.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
