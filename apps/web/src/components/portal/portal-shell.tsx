'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

import { Sidebar } from '@/components/portal/sidebar';
import { TopBar } from '@/components/portal/topbar';

type PortalShellProps = {
  restaurantName: string;
  signOutAction: () => Promise<void>;
  children: ReactNode;
};

/**
 * The one client boundary the portal layout needs: which state the mobile
 * sidebar overlay is in. Everything else about the shell - the restaurant
 * name, the sign-out action - is resolved server-side in `(portal)/layout.tsx`
 * and passed down as plain props.
 */
export function PortalShell({ restaurantName, signOutAction, children }: PortalShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar isOpen={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          restaurantName={restaurantName}
          signOutAction={signOutAction}
          onMenuClick={() => setIsMobileNavOpen(true)}
        />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
