import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { PortalShell } from '@/components/portal/portal-shell';
import { signOutAction } from '@/modules/auth/actions';
import { getProfileForCurrentUser } from '@/modules/restaurant-profile/actions';
import { auth } from '~/auth';

/**
 * Shared chrome for every authenticated page: a persistent sidebar, a top
 * bar with the restaurant's name and a sign-out menu, and nothing else -
 * each page underneath still owns its own heading, width, and content.
 *
 * A route group (`(portal)`), not a URL segment: the parenthesised folder
 * name is invisible to the router, so every page that moves under it keeps
 * the exact route it already had - `/dashboard` stays `/dashboard` - and
 * proxy.ts's matcher, which guards those same paths, needs no change.
 */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  // The proxy already turns anonymous visitors away; checking here is the
  // same defense-in-depth every page under this layout already practises on
  // its own, now shared instead of repeated.
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const profile = await getProfileForCurrentUser();

  return (
    <PortalShell restaurantName={profile?.name ?? 'Your Restaurant'} signOutAction={signOutAction}>
      {children}
    </PortalShell>
  );
}
