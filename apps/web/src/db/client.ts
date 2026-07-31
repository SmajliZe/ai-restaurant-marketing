import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from '@/db/schema';

/**
 * postgres.js rather than node-postgres (`pg`).
 *
 * Both are first-class Drizzle drivers, so the choice comes down to weight:
 * postgres.js is one dependency with no native build step and pooling built in,
 * where `pg` needs `@types/pg` alongside it and a `Pool` wired up by hand. The
 * one thing to remember is that its prepared statements do not survive a
 * transaction pooler such as PgBouncer, so anything deployed behind one has to
 * pass `prepare: false` here.
 */

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * Next reloads modules on every edit in development, and a fresh pool per
 * reload exhausts Postgres' connection limit within a few saves. Parking the
 * client on globalThis keeps one pool across reloads.
 */
const globalForDatabase = globalThis as unknown as {
  restaurantAiDatabase?: Database;
};

/**
 * Returns the shared client, opening the pool on first use.
 *
 * Deliberately a function rather than a module-level constant: a constant would
 * connect as soon as anything imported this file, which fails a production
 * build where `DATABASE_URL` is not present.
 */
export function getDb(): Database {
  const existing = globalForDatabase.restaurantAiDatabase;
  if (existing) {
    return existing;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const database = drizzle(postgres(connectionString, { max: 10 }), { schema });
  globalForDatabase.restaurantAiDatabase = database;
  return database;
}
