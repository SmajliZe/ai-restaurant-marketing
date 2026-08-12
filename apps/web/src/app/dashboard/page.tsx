import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getDashboardStats } from '@/modules/content-history/actions';
import { auth } from '~/auth';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  // The proxy already turns anonymous visitors away; checking here is what
  // stops the page rendering if it ever stops matching this route.
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/dashboard');
  }

  const stats = await getDashboardStats();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-accent text-sm font-medium tracking-widest uppercase">Dashboard</p>
        <h1 className="text-3xl font-semibold text-balance">Your content at a glance</h1>
      </header>

      {stats === null ? (
        <ProfileRequired />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Total generated" value={stats.totalCount} />
            <StatCard label="Generated this month" value={stats.thisMonthCount} />
          </div>

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium tracking-widest text-slate-500 uppercase">
                Recent activity
              </h2>
              <Link
                href="/history"
                className="text-accent text-sm underline-offset-4 hover:underline"
              >
                View all
              </Link>
            </div>

            {stats.recent.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing generated yet.</p>
            ) : (
              <ul className="divide-y divide-slate-800">
                {stats.recent.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-100">{entry.recognizedDish}</span>
                      <span className="text-xs text-slate-500">{formatDate(entry.createdAt)}</span>
                    </div>
                    <Link
                      href={`/history#${entry.id}`}
                      className="text-accent text-sm underline-offset-4 hover:underline"
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface-muted flex flex-col gap-1 rounded-lg p-6">
      <span className="text-xs font-medium tracking-widest text-slate-500 uppercase">{label}</span>
      <span className="text-3xl font-semibold text-slate-100">{value}</span>
    </div>
  );
}

/** Shown instead of stats, rather than redirecting - same reasoning as /generate. */
function ProfileRequired() {
  return (
    <section className="flex flex-col items-start gap-4 rounded-lg border border-amber-900/60 bg-amber-950/30 p-6">
      <h2 className="text-lg font-medium text-amber-100">Complete your restaurant profile first</h2>
      <p className="max-w-xl text-sm text-amber-200/80">
        There is nothing to show here until you have a restaurant profile and have generated some
        content.
      </p>
      <Link
        href="/profile"
        className="bg-accent rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-950"
      >
        Go to your profile
      </Link>
    </section>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
