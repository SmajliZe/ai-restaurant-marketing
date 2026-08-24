import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RestaurantProfile } from '@/modules/restaurant-profile/types';

import type { AnalyticsSummary } from './types';

const { getProfileForCurrentUser, getAnalyticsSummaryMock } = vi.hoisted(() => ({
  getProfileForCurrentUser: vi.fn(),
  getAnalyticsSummaryMock: vi.fn(),
}));

vi.mock('@/modules/restaurant-profile/actions', () => ({ getProfileForCurrentUser }));
vi.mock('@/modules/analytics/repository', () => ({ analyticsRepository: {} }));
vi.mock('@/modules/analytics/service', () => ({ getAnalyticsSummary: getAnalyticsSummaryMock }));

const { getAnalyticsForCurrentUser } = await import('./actions');

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_RESTAURANT_ID = '22222222-2222-4222-8222-222222222222';

const PROFILE = { id: RESTAURANT_ID } as RestaurantProfile;

const SUMMARY: AnalyticsSummary = {
  generationTrend: [],
  contentTypeBreakdown: [],
  topHashtags: [],
  totalGenerations: 0,
  generationsThisMonth: 0,
};

beforeEach(() => {
  getProfileForCurrentUser.mockResolvedValue(PROFILE);
  getAnalyticsSummaryMock.mockResolvedValue(SUMMARY);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('getAnalyticsForCurrentUser', () => {
  it("resolves the restaurant id from the session's own profile, not anywhere else", async () => {
    await getAnalyticsForCurrentUser();

    expect(getAnalyticsSummaryMock).toHaveBeenCalledWith(RESTAURANT_ID, expect.anything());
    expect(getAnalyticsSummaryMock).not.toHaveBeenCalledWith(
      OTHER_RESTAURANT_ID,
      expect.anything(),
    );
  });

  it('returns the computed summary', async () => {
    expect(await getAnalyticsForCurrentUser()).toEqual(SUMMARY);
  });

  it("returns null without a profile, rather than somebody else's data", async () => {
    getProfileForCurrentUser.mockResolvedValue(null);

    expect(await getAnalyticsForCurrentUser()).toBeNull();
    expect(getAnalyticsSummaryMock).not.toHaveBeenCalled();
  });
});
