'use client';

import { useActionState } from 'react';

import { TextField } from '@/components/ui/form-field';
import { loginAction } from '@/modules/auth/actions';

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {callbackUrl !== undefined && <input type="hidden" name="callbackUrl" value={callbackUrl} />}

      <TextField label="Email" name="email" type="email" required autoComplete="email" />
      <TextField
        label="Password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
      />

      {state !== null && (
        <p role="alert" className="text-sm text-rose-400">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="bg-accent w-full rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
      >
        {isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
