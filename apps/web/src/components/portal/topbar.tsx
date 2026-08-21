'use client';

import { UserMenu } from '@/components/portal/user-menu';

type TopBarProps = {
  restaurantName: string;
  signOutAction: () => Promise<void>;
  onMenuClick: () => void;
};

export function TopBar({ restaurantName, signOutAction, onMenuClick }: TopBarProps) {
  return (
    <header className="flex items-center justify-between border-b border-slate-800 px-4 py-4 sm:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="text-slate-400 hover:text-slate-100 lg:hidden"
        >
          <MenuIcon />
        </button>
        <span className="text-base font-semibold text-slate-200 sm:text-lg">{restaurantName}</span>
      </div>

      <UserMenu signOutAction={signOutAction} />
    </header>
  );
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path strokeLinecap="round" d="M3 5.5h14M3 10h14M3 14.5h14" />
    </svg>
  );
}
