import type { Metadata } from 'next';
import Link from 'next/link';

import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; registered?: string }>;
}) {
  const { callbackUrl, registered } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-slate-400">
          Manage your restaurant profile and generated posts.
        </p>
      </header>

      {registered !== undefined && (
        <p
          role="status"
          className="rounded-lg border border-emerald-900/60 bg-emerald-950/30 p-3 text-sm text-emerald-200"
        >
          Your account is ready. Sign in to continue.
        </p>
      )}

      <LoginForm callbackUrl={callbackUrl} />

      <p className="text-sm text-slate-400">
        No account yet?{' '}
        <Link href="/register" className="text-accent underline-offset-4 hover:underline">
          Create one
        </Link>
      </p>
    </main>
  );
}
