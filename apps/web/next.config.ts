import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  experimental: {
    serverActions: {
      // Server Actions cap request bodies at 1 MB by default, which a 10 MB
      // photo blows past before our own validation ever runs. The headroom over
      // MAX_UPLOAD_BYTES covers multipart boundaries and part headers, so an
      // oversized upload is refused by our check with a readable message rather
      // than by the framework with an opaque one.
      bodySizeLimit: '11mb',
    },
  },

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
