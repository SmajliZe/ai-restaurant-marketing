import { defineConfig } from 'drizzle-kit';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL must be set to generate or run migrations.');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: connectionString },
  // Surfaces a prompt before anything destructive lands in a migration.
  strict: true,
  verbose: true,
});
