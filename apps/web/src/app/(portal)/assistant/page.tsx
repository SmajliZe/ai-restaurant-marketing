import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AssistantChatPanel } from '@/components/marketing-assistant/assistant-chat-panel';
import { getConversationForCurrentUser } from '@/modules/marketing-assistant/actions';
import { getProfileForCurrentUser } from '@/modules/restaurant-profile/actions';
import { auth } from '~/auth';

export const metadata: Metadata = {
  title: 'Marketing assistant',
  description: "Chat with an AI marketing assistant grounded in your restaurant's activity.",
};

export default async function AssistantPage() {
  // The proxy already turns anonymous visitors away; checking here is what
  // stops the page rendering if it ever stops matching this route.
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/assistant');
  }

  const profile = await getProfileForCurrentUser();
  const conversation = profile === null ? null : await getConversationForCurrentUser();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-accent text-sm font-medium tracking-widest uppercase">Assistant</p>
        <h1 className="text-3xl font-semibold text-balance">Your marketing assistant</h1>
        <p className="max-w-2xl text-slate-400">
          Ask what to post, how to run a promotion, or how to boost engagement - grounded in your
          restaurant&apos;s actual recent activity, not generic advice.
        </p>
      </header>

      {profile === null || conversation === null ? (
        <ProfileRequired />
      ) : (
        <AssistantChatPanel initialMessages={conversation.messages} />
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
        The assistant answers grounded in your restaurant, so we need your Account Info filled in
        before you can chat with it.
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
