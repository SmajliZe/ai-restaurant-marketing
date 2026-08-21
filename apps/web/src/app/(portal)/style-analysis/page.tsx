import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { StyleAnalysisPanel } from '@/components/style-analysis/style-analysis-panel';
import { getProfileForCurrentUser } from '@/modules/restaurant-profile/actions';
import { getStyleAnalysesForCurrentUser } from '@/modules/style-analysis/actions';
import { auth } from '~/auth';

export const metadata: Metadata = {
  title: 'Style analysis',
  description: 'An original design and content plan inspired by profiles you admire.',
};

export default async function StyleAnalysisPage() {
  // The proxy already turns anonymous visitors away; checking here is what
  // stops the page rendering if it ever stops matching this route.
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/style-analysis');
  }

  const profile = await getProfileForCurrentUser();
  const initialAnalyses =
    profile === null ? [] : ((await getStyleAnalysesForCurrentUser()) ?? []);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-accent text-sm font-medium tracking-widest uppercase">
          Style analysis
        </p>
        <h1 className="text-3xl font-semibold text-balance">
          Get inspired by accounts you admire
        </h1>
        <p className="max-w-2xl text-slate-400">
          Upload up to three Instagram profiles whose look and content you admire - a feed
          overview and a few favorite posts from each - and get an original design and content
          plan for your own restaurant, inspired by the patterns that recur across them. Never a
          copy of any single post.
        </p>
      </header>

      {profile === null ? (
        <ProfileRequired />
      ) : (
        <StyleAnalysisPanel initialAnalyses={initialAnalyses} />
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
        Your style plan is written for your own cuisine and brand, so we need your Account Info
        filled in before we can build one.
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
