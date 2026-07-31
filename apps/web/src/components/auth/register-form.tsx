'use client';

import { useActionState } from 'react';

import { TextField } from '@/components/ui/form-field';
import { registerAction } from '@/modules/auth/actions';
import { MIN_PASSWORD_LENGTH } from '@/modules/auth/constants';

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(registerAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField label="Email" name="email" type="email" required autoComplete="email" />
      <TextField
        label="Password"
        name="password"
        type="password"
        required
        autoComplete="new-password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
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
        {isPending ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}
