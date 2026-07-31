import type { Metadata } from 'next';
import Link from 'next/link';

import { RegisterForm } from '@/components/auth/register-form';

export const metadata: Metadata = { title: 'Create an account' };

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Create an account</h1>
        <p className="text-sm text-slate-400">
          One account per restaurant. You can fill in the profile afterwards.
        </p>
      </header>

      <RegisterForm />

      <p className="text-sm text-slate-400">
        Already registered?{' '}
        <Link href="/login" className="text-accent underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
