import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RestaurantProfile } from '@/modules/restaurant-profile/types';

import type { NewGeneratedContentEntry } from './types';

const { getProfileForCurrentUser, repositoryMock } = vi.hoisted(() => ({
  getProfileForCurrentUser: vi.fn(),
  repositoryMock: {
    create: vi.fn(),
    findByRestaurantId: vi.fn(),
    countByRestaurantId: vi.fn(),
    countByRestaurantIdSince: vi.fn(),
  },
}));

vi.mock('@/modules/restaurant-profile/actions', () => ({ getProfileForCurrentUser }));
vi.mock('@/modules/content-history/repository', () => ({
  contentHistoryRepository: repositoryMock,
}));

const { getDashboardStats, getHistoryForCurrentUser, saveGeneratedContent } =
  await import('./actions');

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_RESTAURANT_ID = '22222222-2222-4222-8222-222222222222';

function entry(): NewGeneratedContentEntry {
  return {
    recognizedDish: 'Margherita pizza',
    confidence: 0.9,
    instagram: { caption: 'caption', hashtags: [] },
    facebook: { post: 'post', hashtags: [] },
    story: { text: 'text', cta: 'cta', stickerType: 'poll', stickerPrompt: 'prompt' },
    enhancedImagePath: '/api/enhanced-images/abc.jpg',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  repositoryMock.findByRestaurantId.mockResolvedValue([]);
  repositoryMock.countByRestaurantId.mockResolvedValue(0);
  repositoryMock.countByRestaurantIdSince.mockResolvedValue(0);
});

describe('getHistoryForCurrentUser', () => {
  it("reads only the session account's own restaurant", async () => {
    getProfileForCurrentUser.mockResolvedValue({ id: RESTAURANT_ID } as RestaurantProfile);

    await getHistoryForCurrentUser(10, 20);

    expect(repositoryMock.findByRestaurantId).toHaveBeenCalledWith(RESTAURANT_ID, 10, 20);
    expect(repositoryMock.countByRestaurantId).toHaveBeenCalledWith(RESTAURANT_ID);
  });

  it("never queries with another account's restaurant id", async () => {
    getProfileForCurrentUser.mockResolvedValue({ id: RESTAURANT_ID } as RestaurantProfile);

    await getHistoryForCurrentUser(10, 0);

    expect(repositoryMock.findByRestaurantId).not.toHaveBeenCalledWith(
      OTHER_RESTAURANT_ID,
      expect.anything(),
      expect.anything(),
    );
  });

  it("returns null without a profile, rather than somebody else's data", async () => {
    getProfileForCurrentUser.mockResolvedValue(null);

    expect(await getHistoryForCurrentUser(10, 0)).toBeNull();
    expect(repositoryMock.findByRestaurantId).not.toHaveBeenCalled();
    expect(repositoryMock.countByRestaurantId).not.toHaveBeenCalled();
  });
});

describe('getDashboardStats', () => {
  it("reads only the session account's own restaurant", async () => {
    getProfileForCurrentUser.mockResolvedValue({ id: RESTAURANT_ID } as RestaurantProfile);

    await getDashboardStats();

    expect(repositoryMock.countByRestaurantId).toHaveBeenCalledWith(RESTAURANT_ID);
    expect(repositoryMock.countByRestaurantIdSince).toHaveBeenCalledWith(
      RESTAURANT_ID,
      expect.any(Date),
    );
    expect(repositoryMock.findByRestaurantId).toHaveBeenCalledWith(RESTAURANT_ID, 5, 0);
  });

  it('returns null without a profile', async () => {
    getProfileForCurrentUser.mockResolvedValue(null);

    expect(await getDashboardStats()).toBeNull();
    expect(repositoryMock.countByRestaurantId).not.toHaveBeenCalled();
  });
});

describe('saveGeneratedContent', () => {
  it('writes under exactly the restaurant id it was given', async () => {
    repositoryMock.create.mockResolvedValue({ id: 'row-1' });

    await saveGeneratedContent(RESTAURANT_ID, entry());

    expect(repositoryMock.create).toHaveBeenCalledWith(RESTAURANT_ID, entry());
  });
});
