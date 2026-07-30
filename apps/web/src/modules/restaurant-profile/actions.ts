'use server';

import { revalidatePath } from 'next/cache';

import { restaurantRepository } from '@/modules/restaurant-profile/repository';
import { getProfile, saveProfile } from '@/modules/restaurant-profile/service';
import type { RestaurantProfile, SaveProfileResult } from '@/modules/restaurant-profile/types';
import { auth } from '~/auth';

const SIGN_IN_AGAIN = 'Your session has expired. Sign in again to save your profile.';

export type ProfileActionState =
  { status: 'idle' } | { status: 'saved' } | { status: 'error'; message: string };

/**
 * Create or update the signed-in account's restaurant profile.
 *
 * The owner comes from the session, never from the submission. A form field
 * naming the account would be the whole authorisation model, and it would be
 * one edited request away from writing to somebody else's profile.
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
  return { status: 'saved' };
}

/** The signed-in account's profile, or null when they have not created one. */
export async function getProfileForCurrentUser(): Promise<RestaurantProfile | null> {
  const session = await auth();
  const ownerId = session?.user?.id;

  if (!ownerId) {
    return null;
  }

  return getProfile(ownerId, restaurantRepository);
}
