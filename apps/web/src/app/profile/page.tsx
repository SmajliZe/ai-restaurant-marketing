import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ProfileForm } from '@/components/restaurant-profile/profile-form';
import { getProfileForCurrentUser } from '@/modules/restaurant-profile/actions';
import { auth } from '~/auth';

export const metadata: Metadata = { title: 'Restaurant profile' };

export default async function ProfilePage() {
  // The proxy already redirects an anonymous visitor, but it only guards the
  // route. Checking again here is what actually keeps the page from rendering
  // without a session.
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/profile');
  }

  const profile = await getProfileForCurrentUser();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-accent text-sm font-medium tracking-widest uppercase">
          {profile === null ? 'Set up' : 'Your restaurant'}
        </p>
        <h1 className="text-3xl font-semibold text-balance">
          {profile === null ? 'Tell us about your restaurant' : profile.name}
        </h1>
        <p className="max-w-2xl text-slate-400">
          {profile === null
            ? 'We use this to decide how your posts sound. Only the first section is required; the rest can wait.'
            : 'Everything here feeds into the captions we write for you.'}
        </p>
      </header>

      <ProfileForm profile={profile} />
    </main>
  );
}
