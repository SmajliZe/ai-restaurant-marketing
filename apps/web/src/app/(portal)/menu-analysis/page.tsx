import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { MenuAnalysisPanel } from '@/components/menu-analysis/menu-analysis-panel';
import { getAnalysesForCurrentUser } from '@/modules/menu-analysis/actions';
import { getProfileForCurrentUser } from '@/modules/restaurant-profile/actions';
import { auth } from '~/auth';

export const metadata: Metadata = {
  title: 'Menu analysis',
  description: 'Consultative feedback on a photo of your menu.',
};

export default async function MenuAnalysisPage() {
  // The proxy already turns anonymous visitors away; checking here is what
  // stops the page rendering if it ever stops matching this route.
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/menu-analysis');
  }

  const profile = await getProfileForCurrentUser();
  const initialAnalyses = profile === null ? [] : ((await getAnalysesForCurrentUser()) ?? []);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-accent text-sm font-medium tracking-widest uppercase">
          Menu analysis
        </p>
        <h1 className="text-3xl font-semibold text-balance">Get feedback on your menu</h1>
        <p className="max-w-2xl text-slate-400">
          Upload a photo of your menu for consultative feedback grounded in the actual items,
          prices, and descriptions on it - pricing notes, upselling and cross-selling ideas, gaps,
          and concrete improvements. Not marketing copy.
        </p>
      </header>

      {profile === null ? (
        <ProfileRequired />
      ) : (
        <MenuAnalysisPanel initialAnalyses={initialAnalyses} />
      )}
    </main>
  );
}

/** Shown instead of the panel, rather than redirecting - same reasoning as /generate. */
function ProfileRequired() {
  return (
    <section className="flex flex-col items-start gap-4 rounded-lg border border-amber-900/60 bg-amber-950/30 p-6">
      <h2 className="text-lg font-medium text-amber-100">Complete your Account Info first</h2>
      <p className="max-w-xl text-sm text-amber-200/80">
        Menu feedback is grounded in what your restaurant serves, so we need your Account Info
        filled in before we can analyze a menu.
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
