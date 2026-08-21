'use client';

import { useState } from 'react';

type UserMenuProps = {
  /** Passed down from the server layout - see PortalShell. Auth.js's own
   * `signOut`, wrapped once in `signOutAction`, not reimplemented here. */
  signOutAction: () => Promise<void>;
};

export function UserMenu({ signOutAction }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="border-surface-muted bg-surface-muted flex h-8 w-8 items-center justify-center rounded-full border text-sm font-medium text-slate-300 hover:text-slate-100"
      >
        <UserIcon />
      </button>

      {isOpen && (
        <>
          {/* Click-outside-to-close target, behind the menu itself. */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="bg-surface absolute right-0 z-50 mt-2 w-40 rounded-lg border border-slate-800 p-1 shadow-lg shadow-black/20"
          >
            <form action={signOutAction}>
              <button
                type="submit"
                role="menuitem"
                className="hover:bg-surface-muted w-full rounded-md px-3 py-2 text-left text-sm text-slate-300 hover:text-slate-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

function UserIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="10" cy="6.5" r="3" />
      <path strokeLinecap="round" d="M3.5 17c1-3.5 4-5 6.5-5s5.5 1.5 6.5 5" />
    </svg>
  );
}
