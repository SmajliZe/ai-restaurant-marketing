import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { verifyPassword } from '@/modules/auth/password';
import { userRepository } from '@/modules/auth/repository';
import { authConfig } from '~/auth.config';

/**
 * Runs in the Node runtime only: `authorize` touches bcrypt and Postgres.
 *
 * AUTH_SECRET is read from the environment by Auth.js itself, so it is not
 * repeated here.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = typeof credentials.email === 'string' ? credentials.email : '';
        const password = typeof credentials.password === 'string' ? credentials.password : '';

        if (!email || !password) {
          return null;
        }

        const user = await userRepository.findByEmail(email.trim().toLowerCase());
        if (!user) {
          return null;
        }

        // Returning null for both "no such user" and "wrong password" keeps the
        // response from telling an attacker which addresses are registered.
        if (!(await verifyPassword(password, user.passwordHash))) {
          return null;
        }

        return { id: user.id, email: user.email };
      },
    }),
  ],
});
