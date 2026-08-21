import type { Metadata } from 'next';
import Link from 'next/link';

import { getCalendarForCurrentWeek } from '@/modules/content-calendar/actions';
import { getCampaignsForCurrentUser } from '@/modules/content-campaign/actions';
import { getDashboardStats } from '@/modules/content-history/actions';
import { getAnalysesForCurrentUser } from '@/modules/menu-analysis/actions';
import { getStyleAnalysesForCurrentUser } from '@/modules/style-analysis/actions';

import { ACTIVITY_KIND_LABELS, buildRecentActivity } from './activity';
import { SavedBanner } from './saved-banner';

export const metadata: Metadata = { title: 'Dashboard' };

type QuickAction = { href: string; label: string; description: string };

const QUICK_ACTIONS: QuickAction[] = [
  {
    href: '/generate',
    label: 'Create Post',
    description: 'Turn a dish photo into a caption and a polished photo.',
  },
  {
    href: '/calendar',
    label: 'Content Calendar',
    description: 'Plan a theme and content angle for each day of the week.',
  },
  {
    href: '/campaigns',
    label: 'Campaigns',
    description: 'Build a complete campaign package around one occasion.',
  },
  {
    href: '/menu-analysis',
    label: 'Menu Analysis',
    description: 'Get consultative feedback on a photo of your menu.',
  },
  {
    href: '/style-analysis',
    label: 'Style Analysis',
    description: 'Get a design plan inspired by Instagram accounts you admire.',
  },
  {
    href: '/assistant',
    label: 'AI Assistant',
    description: 'Ask what to post today or how to boost engagement.',
  },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;

  // Every read here is the same ownership-scoped function its own page
  // already calls - getDashboardStats resolves the "no profile yet" case for
  // all of them, since a restaurant with no profile has nothing in any of
  // these tables either.
  const [stats, campaigns, calendarWeek, menuAnalyses, styleAnalyses] = await Promise.all([
    getDashboardStats(),
    getCampaignsForCurrentUser(),
    getCalendarForCurrentWeek(),
    getAnalysesForCurrentUser(),
    getStyleAnalysesForCurrentUser(),
  ]);

  const activity =
    stats === null
      ? []
      : buildRecentActivity({
          generatedContent: stats.recent,
          campaigns: campaigns ?? [],
          calendarEntries: calendarWeek?.entries ?? [],
          menuAnalyses: menuAnalyses ?? [],
          styleAnalyses: styleAnalyses ?? [],
        });

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="page-eyebrow">Dashboard</p>
        <h1 className="page-heading">Your content at a glance</h1>
      </header>

      {saved === '1' && <SavedBanner />}

      {stats === null ? (
        <ProfileRequired />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Total generated" value={stats.totalCount} />
            <StatCard label="Generated this month" value={stats.thisMonthCount} />
          </div>

          <section className="flex flex-col gap-4">
            <h2 className="text-xs font-medium tracking-widest text-slate-500 uppercase">
              Quick actions
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_ACTIONS.map((action) => (
                <QuickActionCard key={action.href} {...action} />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-xs font-medium tracking-widest text-slate-500 uppercase">
              Recent activity
            </h2>

            {activity.length === 0 ? (
              <p className="empty-state-text">Nothing generated yet.</p>
            ) : (
              <ul className="divide-y divide-slate-800">
                {activity.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium tracking-widest text-slate-500 uppercase">
                        {ACTIVITY_KIND_LABELS[item.kind]}
                      </span>
                      <span className="font-medium text-slate-100">{item.label}</span>
                      <span className="text-xs text-slate-500">{formatDate(item.date)}</span>
                    </div>
                    <Link
                      href={item.href}
                      className="text-accent shrink-0 text-sm underline-offset-4 hover:underline"
                    >
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function QuickActionCard({ href, label, description }: QuickAction) {
  return (
    <Link
      href={href}
      className="border-surface-muted hover:border-accent/50 flex flex-col gap-1.5 rounded-lg border p-5 transition-colors"
    >
      <span className="font-medium text-slate-100">{label}</span>
      <span className="text-sm text-slate-400">{description}</span>
    </Link>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface-muted flex flex-col gap-1 rounded-lg p-6">
      <span className="text-xs font-medium tracking-widest text-slate-500 uppercase">{label}</span>
      <span className="text-3xl font-semibold text-slate-100">{value}</span>
    </div>
  );
}

/** Shown above everything else, rather than redirecting - same reasoning as /generate. */
function ProfileRequired() {
  return (
    <section className="flex flex-col items-start gap-4 rounded-lg border border-amber-900/60 bg-amber-950/30 p-6">
      <h2 className="text-lg font-medium text-amber-100">Complete your Account Info first</h2>
      <p className="max-w-xl text-sm text-amber-200/80">
        There is nothing to show here until you have completed your Account Info and generated
        some content.
      </p>
      <Link
        href="/profile"
        className="bg-accent rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-950"
      >
        Go to Account Info
      </Link>
    </section>
  );
}

function formatDate(date: Date): string {
  // A fixed timeZone, rather than the runtime's own, so this renders the
  // same on the server and in the browser - see the note on the same
  // pattern in menu-analysis-item.tsx.
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date);
}
