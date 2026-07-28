import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Workspace packages ship TypeScript sources rather than a build artifact,
  // so Next has to compile them alongside the app.
  transpilePackages: ['@restaurant-ai/shared-types'],

  // Produces a self-contained server bundle for the production container image.
  output: 'standalone',

  // Tracing must start at the workspace root, otherwise the standalone bundle
  // misses dependencies that pnpm hoisted above apps/web.
  outputFileTracingRoot: resolve(dirname(fileURLToPath(import.meta.url)), '../..'),
};

export default nextConfig;
