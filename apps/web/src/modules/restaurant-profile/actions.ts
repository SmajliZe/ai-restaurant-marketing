'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { restaurantRepository } from '@/modules/restaurant-profile/repository';
import { getProfile, saveProfile } from '@/modules/restaurant-profile/service';
import type { RestaurantProfile, SaveProfileResult } from '@/modules/restaurant-profile/types';
import { auth } from '~/auth';

const SIGN_IN_AGAIN = 'Your session has expired. Sign in again to save your profile.';

export type ProfileActionState = { status: 'idle' } | { status: 'error'; message: string };

/**
 * Create or update the signed-in account's restaurant profile.
 *
 * The owner comes from the session, never from the submission. A form field
 * naming the account would be the whole authorisation model, and it would be
 * one edited request away from writing to somebody else's profile.
 *
 * A successful save redirects to the dashboard with `?saved=1` rather than
 * returning a `'saved'` state for the form to render inline - the same
 * "redirect and let the destination confirm" pattern `registerAction` already
 * uses (`/login?registered=1`), and one a form buried at the bottom of a long
 * page can't make the visitor miss the way an inline message could.
 */
export async function upsertProfileAction(
  _previous: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const session = await auth();
  const ownerId = session?.user?.id;

  if (!ownerId) {
    return { status: 'error', message: SIGN_IN_AGAIN };
  }

  const result: SaveProfileResult = await saveProfile(ownerId, formData, restaurantRepository);

  if (result.status !== 'saved') {
    return { status: 'error', message: result.message };
  }

  revalidatePath('/profile');
  revalidatePath('/dashboard');
  // `redirect` signals by throwing, so it has to stay outside any catch and
  // is never followed by a `return` - the same shape `registerAction` uses.
  redirect('/dashboard?saved=1');
}

/**
 * The signed-in account's profile, or null when they have not created one.
 *
 * Wrapped in `cache()` so the portal shell's own layout (which needs this
 * for the top bar) and whichever page renders inside it can each call this
 * without turning one request into two identical database reads - `cache()`
 * memoises per request, not across them, so nothing here risks serving one
 * visitor's profile to another.
 */
export const getProfileForCurrentUser = cache(async (): Promise<RestaurantProfile | null> => {
  const session = await auth();
  const ownerId = session?.user?.id;

  if (!ownerId) {
    return null;
  }

  return getProfile(ownerId, restaurantRepository);
});
