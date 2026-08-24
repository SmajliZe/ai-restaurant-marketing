import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ContentTypeBreakdownChart } from '@/components/analytics/content-type-breakdown';
import { GenerationTrendChart } from '@/components/analytics/generation-trend-chart';
import { TopHashtagsList } from '@/components/analytics/top-hashtags-list';
import { getAnalyticsForCurrentUser } from '@/modules/analytics/actions';
import { auth } from '~/auth';

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Generation volume and patterns across everything you have created.',
};

export default async function AnalyticsPage() {
  // The proxy already turns anonymous visitors away; checking here is what
  // stops the page rendering if it ever stops matching this route.
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/analytics');
  }

  // null means no profile yet, the same distinction every other
  // getXForCurrentUser makes - a summary with every count at zero is a
  // different, later state, handled by EmptyState below.
  const summary = await getAnalyticsForCurrentUser();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="page-eyebrow">Analytics</p>
        <h1 className="page-heading">Generation volume and patterns</h1>
        <p className="max-w-2xl text-slate-400">
          How much you have generated and what it looks like, based on what has actually been
          created here - not engagement or real-world performance, which would need data from Meta
          this product does not have yet.
        </p>
      </header>

      {summary === null ? (
        <ProfileRequired />
      ) : summary.totalGenerations === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Total generated" value={summary.totalGenerations} />
            <StatCard label="Generated this month" value={summary.generationsThisMonth} />
          </div>

          <section className="flex flex-col gap-4">
            <h2 className="text-xs font-medium tracking-widest text-slate-500 uppercase">
              Last 30 days
            </h2>
            <div className="border-surface-muted rounded-lg border p-6">
              <GenerationTrendChart trend={summary.generationTrend} />
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-xs font-medium tracking-widest text-slate-500 uppercase">
              By content type
            </h2>
            <div className="border-surface-muted rounded-lg border p-6">
              <ContentTypeBreakdownChart breakdown={summary.contentTypeBreakdown} />
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-xs font-medium tracking-widest text-slate-500 uppercase">
              Top hashtags
            </h2>
            <div className="border-surface-muted rounded-lg border px-6">
              <TopHashtagsList hashtags={summary.topHashtags} />
            </div>
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

/** Shown instead of the charts, rather than redirecting - same reasoning as /generate. */
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

/** Shown instead of three empty charts, which would look broken rather than simply quiet. */
function EmptyState() {
  return (
    <section className="flex flex-col items-start gap-4 rounded-lg border border-slate-800 p-6">
      <h2 className="text-lg font-medium text-slate-100">Nothing to analyze yet</h2>
      <p className="empty-state-text max-w-xl">
        Generate a post, plan a week, build a campaign, or run an analysis, and this page fills in
        with your own generation trends and patterns.
      </p>
      <Link
        href="/generate"
        className="bg-accent rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-950"
      >
        Create your first post
      </Link>
    </section>
  );
}
