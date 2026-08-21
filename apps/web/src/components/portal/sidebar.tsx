'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { isNavItemActive } from '@/components/portal/nav-active';

type NavLink = { href: string; label: string };

const CONTENT_LINKS: NavLink[] = [
  { href: '/generate', label: 'Create Post' },
  { href: '/calendar', label: 'Content Calendar' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/history', label: 'History' },
];

const INSIGHTS_LINKS: NavLink[] = [
  { href: '/menu-analysis', label: 'Menu Analysis' },
  { href: '/style-analysis', label: 'Style Analysis' },
];

type SidebarProps = {
  /** Whether the mobile overlay is open. Ignored above the `lg` breakpoint,
   * where the sidebar is always visible. */
  isOpen: boolean;
  onClose: () => void;
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}

      <aside
        className={`bg-surface fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-slate-800 transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <span className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-100">
            <span className="bg-accent h-2 w-2 rounded-full" aria-hidden="true" />
            Plateful
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="text-slate-400 hover:text-slate-100 lg:hidden"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 pb-6">
          <div className="flex flex-col gap-0.5">
            <NavItem href="/dashboard" label="Dashboard" onNavigate={onClose} />
            <NavItem href="/profile" label="Account Info" onNavigate={onClose} />
          </div>

          <NavSection title="Content" links={CONTENT_LINKS} onNavigate={onClose} />
          <NavSection title="Insights" links={INSIGHTS_LINKS} onNavigate={onClose} />

          <div className="flex flex-col gap-0.5">
            <NavItem href="/assistant" label="AI Assistant" onNavigate={onClose} />
          </div>
        </nav>
      </aside>
    </>
  );
}

function NavSection({
  title,
  links,
  onNavigate,
}: {
  title: string;
  links: NavLink[];
  onNavigate: () => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="px-3 pb-1 text-xs font-medium tracking-widest text-slate-500 uppercase">
        {title}
      </p>
      {links.map((link) => (
        <NavItem key={link.href} href={link.href} label={link.label} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function NavItem({
  href,
  label,
  onNavigate,
}: {
  href: string;
  label: string;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const isActive = isNavItemActive(pathname, href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={`rounded-lg px-3 py-2.5 text-base leading-normal font-medium transition-colors ${
        isActive
          ? 'bg-surface-muted text-slate-100'
          : 'text-slate-400 hover:bg-surface-muted hover:text-slate-100'
      }`}
    >
      {label}
    </Link>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path strokeLinecap="round" d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}
