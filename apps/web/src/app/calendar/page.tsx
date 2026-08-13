import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CalendarPanel } from '@/components/content-calendar/calendar-panel';
import { getCalendarForCurrentWeek } from '@/modules/content-calendar/actions';
import { getProfileForCurrentUser } from '@/modules/restaurant-profile/actions';
import { auth } from '~/auth';

export const metadata: Metadata = {
  title: 'Content calendar',
  description: 'A theme and content angle for each day of the week.',
};

export default async function CalendarPage() {
  // The proxy already turns anonymous visitors away; checking here is what
  // stops the page rendering if it ever stops matching this route.
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/calendar');
  }

  const profile = await getProfileForCurrentUser();
  const initialWeek = profile === null ? null : await getCalendarForCurrentWeek();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-accent text-sm font-medium tracking-widest uppercase">
          Content calendar
        </p>
        <h1 className="text-3xl font-semibold text-balance">This week&apos;s plan</h1>
        <p className="max-w-2xl text-slate-400">
          A theme and content angle for each day, Monday through Sunday - planning guidance to act
          on, not finished posts.
        </p>
      </header>

      {profile === null ? <ProfileRequired /> : <CalendarPanel initialWeek={initialWeek} />}
    </main>
  );
}

/** Shown instead of the plan, rather than redirecting - same reasoning as /generate. */
function ProfileRequired() {
  return (
    <section className="flex flex-col items-start gap-4 rounded-lg border border-amber-900/60 bg-amber-950/30 p-6">
      <h2 className="text-lg font-medium text-amber-100">Complete your restaurant profile first</h2>
      <p className="max-w-xl text-sm text-amber-200/80">
        A weekly plan is written in your restaurant&apos;s voice, so we need to know the tone you
        want and what you serve before we can plan anything.
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
