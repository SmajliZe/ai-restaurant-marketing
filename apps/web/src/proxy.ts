import NextAuth from 'next-auth';

import { authConfig } from '~/auth.config';

/**
 * Route protection.
 *
 * Named `proxy.ts` rather than `middleware.ts`: Next 16 renamed the convention,
 * and the old name is deprecated.
 *
 * Built from `authConfig` alone so nothing here needs the Node runtime - this
 * only verifies the session JWT's signature, it does not read the database.
 * Pages and Server Actions still call `auth()` themselves; this is the redirect,
 * not the authorisation.
 */
const { auth } = NextAuth(authConfig);

export default auth((request) => {
  if (request.auth) {
    return undefined;
  }

  const signInUrl = new URL('/login', request.nextUrl.origin);
  // So the user lands back where they were headed once they are signed in.
  signInUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);

  return Response.redirect(signInUrl);
});

export const config = {
  matcher: ['/generate/:path*', '/profile/:path*', '/dashboard/:path*'],
};
