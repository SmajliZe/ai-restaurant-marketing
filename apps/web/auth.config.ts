import type { NextAuthConfig } from 'next-auth';

/**
 * The half of the Auth.js config that can run anywhere.
 *
 * The proxy that guards routes runs on the Edge runtime, where bcrypt and the
 * Postgres driver do not exist. Keeping the providers out of this file lets the
 * proxy verify a JWT without dragging either of them into the Edge bundle;
 * `auth.ts` adds the Credentials provider for the Node runtime.
 */
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      // `user` is only set on the request that signs in.
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
