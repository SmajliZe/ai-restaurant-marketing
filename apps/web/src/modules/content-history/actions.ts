'use server';

import { contentHistoryRepository } from '@/modules/content-history/repository';
import {
  getDashboardStats as computeDashboardStats,
  getHistory,
  saveGeneratedContent as recordGeneratedContent,
} from '@/modules/content-history/service';
import type {
  DashboardStats,
  HistoryPage,
  NewGeneratedContentEntry,
} from '@/modules/content-history/types';
import { getProfileForCurrentUser } from '@/modules/restaurant-profile/actions';

const DEFAULT_PAGE_SIZE = 10;

/**
 * Records one successful generation against `restaurantId`.
 *
 * Takes the id as an argument instead of resolving it from the session: the
 * caller is the content generation action, which already knows it from the
 * profile it just used to make the AI call. The read-side actions below
 * resolve it from the session themselves because, for them, that is the
 * first place in the request a restaurant's identity is established -
 * `saveGeneratedContent` is deliberately not that place a second time.
 */
export async function saveGeneratedContent(
  restaurantId: string,
  entry: NewGeneratedContentEntry,
): Promise<void> {
  await recordGeneratedContent(restaurantId, entry, contentHistoryRepository);
}

/**
 * The signed-in account's own generation history, newest first.
 *
 * Returns null when there is no profile yet, the same way
 * `getProfileForCurrentUser` does - there is no restaurant to have history
 * for, which is a different thing from an empty page of history.
 */
export async function getHistoryForCurrentUser(
  limit: number = DEFAULT_PAGE_SIZE,
  offset: number = 0,
): Promise<HistoryPage | null> {
  const profile = await getProfileForCurrentUser();
  if (profile === null) {
    return null;
  }

  return getHistory(profile.id, limit, offset, contentHistoryRepository);
}

/** Summary stats for the signed-in account's own restaurant. */
export async function getDashboardStats(): Promise<DashboardStats | null> {
  const profile = await getProfileForCurrentUser();
  if (profile === null) {
    return null;
  }

  return computeDashboardStats(profile.id, contentHistoryRepository);
}
