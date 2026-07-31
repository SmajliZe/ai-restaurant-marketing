import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ContentGenerationPanel } from '@/components/content-generation/content-generation-panel';
import { getProfileForCurrentUser } from '@/modules/restaurant-profile/actions';
import { auth } from '~/auth';

export const metadata: Metadata = {
  title: 'Generate a caption',
  description:
    'Turn a photo of a dish into an Instagram caption and a polished version of the photo.',
};

export default async function GeneratePage() {
  // The proxy already turns anonymous visitors away; checking here is what
  // stops the page rendering if it ever stops matching this route.
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/generate');
  }

  const profile = await getProfileForCurrentUser();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-accent text-sm font-medium tracking-widest uppercase">
          Content generation
        </p>
        <h1 className="text-3xl font-semibold text-balance">Turn a dish photo into a post</h1>
        <p className="max-w-2xl text-slate-400">
          Upload a photo and we will identify the dish, draft a caption with hashtags, and return a
          colour-corrected version of the photo at its original size. The two run independently, so
          a failure in one still leaves you the other.
        </p>
      </header>

      {profile === null ? (
        <ProfileRequired />
      ) : (
        <>
          {/* Shown so the writing voice is not a surprise. It is read from the
              profile again inside the Server Action, so this is display only. */}
          <p className="bg-surface-muted rounded-lg p-4 text-sm text-slate-300">
            Writing in a{' '}
            <strong className="font-medium text-slate-100">{profile.toneOfVoice}</strong> tone for a{' '}
            <strong className="font-medium text-slate-100">{profile.cuisineType}</strong>{' '}
            restaurant.{' '}
            <Link href="/profile" className="text-accent underline-offset-4 hover:underline">
              Change this
            </Link>
          </p>

          <ContentGenerationPanel />
        </>
      )}
    </main>
  );
}

/**
 * Shown instead of the form, rather than redirecting to /profile.
 *
 * Someone who lands here meant to generate a post; moving them somewhere else
 * without a word leaves them guessing why.
 */
function ProfileRequired() {
  return (
    <section className="flex flex-col items-start gap-4 rounded-lg border border-amber-900/60 bg-amber-950/30 p-6">
      <h2 className="text-lg font-medium text-amber-100">Complete your restaurant profile first</h2>
      <p className="max-w-xl text-sm text-amber-200/80">
        Captions are written in your restaurant&apos;s voice, so we need to know the tone you want
        and what you serve before we can write anything. It takes a minute.
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
