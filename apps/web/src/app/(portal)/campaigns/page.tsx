import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CampaignsPanel } from '@/components/content-campaign/campaigns-panel';
import { getCampaignsForCurrentUser } from '@/modules/content-campaign/actions';
import { getProfileForCurrentUser } from '@/modules/restaurant-profile/actions';
import { auth } from '~/auth';

export const metadata: Metadata = {
  title: 'Campaigns',
  description: 'A complete marketing campaign built around one occasion.',
};

export default async function CampaignsPage() {
  // The proxy already turns anonymous visitors away; checking here is what
  // stops the page rendering if it ever stops matching this route.
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/campaigns');
  }

  const profile = await getProfileForCurrentUser();
  const initialCampaigns = profile === null ? [] : ((await getCampaignsForCurrentUser()) ?? []);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-accent text-sm font-medium tracking-widest uppercase">Campaigns</p>
        <h1 className="text-3xl font-semibold text-balance">Build a campaign for any occasion</h1>
        <p className="max-w-2xl text-slate-400">
          Pick an occasion and get a complete campaign package - name, offer, caption, hashtags,
          story and call to action - built around one cohesive idea.
        </p>
      </header>

      {profile === null ? (
        <ProfileRequired />
      ) : (
        <CampaignsPanel initialCampaigns={initialCampaigns} />
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
        A campaign is written in your restaurant&apos;s voice, so we need to know the tone you
        want and what you serve before we can build one.
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
