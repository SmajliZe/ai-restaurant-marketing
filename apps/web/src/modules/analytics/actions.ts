'use server';

import { analyticsRepository } from '@/modules/analytics/repository';
import { getAnalyticsSummary as computeAnalyticsSummary } from '@/modules/analytics/service';
import type { AnalyticsSummary } from '@/modules/analytics/types';
import { getProfileForCurrentUser } from '@/modules/restaurant-profile/actions';

/**
 * The signed-in account's own generation analytics, or null if there is no
 * profile yet - the same "no restaurant to have data for" distinction every
 * other getXForCurrentUser makes, not an empty summary.
 *
 * The restaurant is read from the session's own profile, never accepted as
 * an argument - the same rule every other module's read functions follow,
 * so a restaurantId can never be supplied from the client.
 */
export async function getAnalyticsForCurrentUser(): Promise<AnalyticsSummary | null> {
  const profile = await getProfileForCurrentUser();
  if (profile === null) {
    return null;
  }

  return computeAnalyticsSummary(profile.id, analyticsRepository);
}
