'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';

import { isDuplicateEmailError, userRepository } from '@/modules/auth/repository';
import { registerUser } from '@/modules/auth/service';
import type { RegisterResult } from '@/modules/auth/types';
import { signIn } from '~/auth';

export type RegisterActionState = { message: string } | null;
export type LoginActionState = { message: string } | null;

/** Deliberately vague: naming which half was wrong tells an attacker which addresses exist. */
const BAD_CREDENTIALS = 'That email and password combination is not right.';

/**
 * Create an account, then send the visitor to the sign-in page.
 *
 * No session is issued here on purpose. Signing up and signing in stay
 * separate steps, so the registration path can never become a way to obtain a
 * session without proving the password.
 */
export async function registerAction(
  _previous: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> {
  const result: RegisterResult = await registerUser(
    {
      email: formData.get('email'),
      password: formData.get('password'),
    },
    userRepository,
    isDuplicateEmailError,
  );

  if (result.status !== 'created') {
    return { message: result.message };
  }

  // `redirect` signals by throwing, so it has to stay outside any catch.
  redirect('/login?registered=1');
}

export async function loginAction(
  _previous: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const callbackUrl = formData.get('callbackUrl');

  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo:
        typeof callbackUrl === 'string' && callbackUrl.startsWith('/') ? callbackUrl : '/profile',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { message: BAD_CREDENTIALS };
    }
    // A successful sign-in reports itself by throwing a redirect, so anything
    // that is not an AuthError has to keep travelling.
    throw error;
  }

  return null;
}
