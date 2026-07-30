/** The columns of a user that anything outside this module is allowed to see. */
export type PublicUser = {
  id: string;
  email: string;
};

/**
 * What the registration service needs from storage.
 *
 * Declared here rather than imported from the repository so the service can be
 * tested against a fake, and so nothing in the module depends on Drizzle.
 */
export type UserRepository = {
  findByEmail: (
    email: string,
  ) => Promise<{ id: string; email: string; passwordHash: string } | null>;
  insert: (user: { email: string; passwordHash: string }) => Promise<PublicUser>;
};

export type RegisterResult =
  | { status: 'created' }
  | { status: 'invalid'; message: string }
  | { status: 'email-taken'; message: string };
