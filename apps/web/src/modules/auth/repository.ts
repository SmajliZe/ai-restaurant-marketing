import { eq } from 'drizzle-orm';

import { getDb } from '@/db/client';
import { users } from '@/db/schema';
import type { UserRepository } from '@/modules/auth/types';

/**
 * Postgres error code for a unique constraint violation.
 *
 * Two registrations for the same address can pass the "is it taken?" check at
 * the same moment; the index is what actually decides, and this is how it says
 * so.
 */
const UNIQUE_VIOLATION = '23505';

export const userRepository: UserRepository = {
  async findByEmail(email) {
    const [row] = await getDb()
      .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return row ?? null;
  },

  async insert({ email, passwordHash }) {
    const [row] = await getDb()
      .insert(users)
      .values({ email, passwordHash })
      // Never select passwordHash back out; nothing downstream needs it.
      .returning({ id: users.id, email: users.email });

    if (!row) {
      throw new Error('Inserting the user returned no row.');
    }

    return row;
  },
};

export function isDuplicateEmailError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === UNIQUE_VIOLATION
  );
}
