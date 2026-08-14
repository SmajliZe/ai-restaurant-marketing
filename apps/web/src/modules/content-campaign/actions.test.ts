import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RestaurantProfile } from '@/modules/restaurant-profile/types';

const { getProfileForCurrentUser, repositoryMock } = vi.hoisted(() => ({
  getProfileForCurrentUser: vi.fn(),
  repositoryMock: {
    create: vi.fn(),
    findByRestaurantId: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/modules/restaurant-profile/actions', () => ({ getProfileForCurrentUser }));
vi.mock('@/modules/content-campaign/repository', () => ({
  contentCampaignRepository: repositoryMock,
}));

const { generateCampaign, getCampaignsForCurrentUser, updateCampaignStatus } =
  await import('./actions');

const AI_SERVICE_URL = 'http://ai-service.test:8000';
const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_RESTAURANT_ID = '22222222-2222-4222-8222-222222222222';

const PROFILE = {
  id: RESTAURANT_ID,
  toneOfVoice: 'luxury',
  cuisineType: 'Neapolitan pizza',
  country: 'Italy',
  language: 'German',
  targetAudience: 'young professionals',
} as RestaurantProfile;

const CAMPAIGN_BODY = {
  name: 'Aperitivo Hour',
  description: 'A relaxed after-work window built around small plates.',
  offer: 'A complimentary small plate with any drink order',
  caption: 'The golden hour just got better.',
  hashtags: ['aperitivo', 'happyhour'],
  story: {
    text: 'Aperitivo hour is calling',
    cta: 'Swipe up to reserve a stool',
    sticker_type: 'countdown',
    sticker_prompt: 'Doors open in',
  },
  cta: 'Reserve your spot for aperitivo hour',
  duration_suggestion: 'Every weekday, 5-7pm',
};

function respondWith(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function storedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-1',
    restaurantId: RESTAURANT_ID,
    occasion: 'Happy Hour',
    name: 'Aperitivo Hour',
    description: 'A relaxed after-work window built around small plates.',
    offer: 'A complimentary small plate with any drink order',
    caption: 'The golden hour just got better.',
    hashtags: ['aperitivo', 'happyhour'],
    story: {
      text: 'Aperitivo hour is calling',
      cta: 'Swipe up to reserve a stool',
      stickerType: 'countdown',
      stickerPrompt: 'Doors open in',
    },
    cta: 'Reserve your spot for aperitivo hour',
    durationSuggestion: 'Every weekday, 5-7pm',
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv('AI_SERVICE_URL', AI_SERVICE_URL);
  getProfileForCurrentUser.mockResolvedValue(PROFILE);
  repositoryMock.create.mockResolvedValue(storedRow());
  repositoryMock.findByRestaurantId.mockResolvedValue([]);
  repositoryMock.updateStatus.mockResolvedValue(null);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('generateCampaign', () => {
  it('stores the generated campaign under the current restaurant', async () => {
    vi.stubGlobal('fetch', respondWith(CAMPAIGN_BODY));

    const result = await generateCampaign('Happy Hour');

    expect(result.status).toBe('generated');
    if (result.status !== 'generated') {
      throw new Error('expected generation to have succeeded');
    }
    expect(result.campaign.name).toBe('Aperitivo Hour');
    expect(repositoryMock.create).toHaveBeenCalledWith(
      RESTAURANT_ID,
      expect.objectContaining({ occasion: 'Happy Hour', name: 'Aperitivo Hour' }),
    );
  });

  it('posts the occasion and restaurant context as JSON', async () => {
    const fetchMock = respondWith(CAMPAIGN_BODY);
    vi.stubGlobal('fetch', fetchMock);

    await generateCampaign('Happy Hour');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${AI_SERVICE_URL}/campaign/generate`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      occasion: 'Happy Hour',
      tone_of_voice: 'luxury',
      cuisine_type: 'Neapolitan pizza',
      country: 'Italy',
      language: 'German',
      target_audience: 'young professionals',
    });
  });

  it('is refused outright when there is no profile, and never calls the AI service', async () => {
    const fetchMock = respondWith(CAMPAIGN_BODY);
    vi.stubGlobal('fetch', fetchMock);
    getProfileForCurrentUser.mockResolvedValue(null);

    const result = await generateCampaign('Happy Hour');

    expect(result).toEqual({
      status: 'rejected',
      message:
        'Complete your restaurant profile before generating a campaign, so we know how to write it.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(repositoryMock.create).not.toHaveBeenCalled();
  });

  it('stores nothing when the AI service call fails', async () => {
    vi.stubGlobal(
      'fetch',
      respondWith({ detail: 'AI service is temporarily busy, please try again in a moment.' }, 503),
    );

    const result = await generateCampaign('Happy Hour');

    expect(result).toEqual({
      status: 'rejected',
      message: 'AI service is temporarily busy, please try again in a moment.',
    });
    expect(repositoryMock.create).not.toHaveBeenCalled();
  });

  it('rejects a malformed AI response without storing anything', async () => {
    vi.stubGlobal('fetch', respondWith({ name: 'Only a name, nothing else.' }));

    const result = await generateCampaign('Happy Hour');

    expect(result).toEqual({
      status: 'rejected',
      message: 'The AI service returned an unexpected response.',
    });
    expect(repositoryMock.create).not.toHaveBeenCalled();
  });
});

describe('getCampaignsForCurrentUser', () => {
  it("reads only the session account's own restaurant", async () => {
    await getCampaignsForCurrentUser();

    expect(repositoryMock.findByRestaurantId).toHaveBeenCalledWith(RESTAURANT_ID);
  });

  it("never queries with another account's restaurant id", async () => {
    await getCampaignsForCurrentUser();

    expect(repositoryMock.findByRestaurantId).not.toHaveBeenCalledWith(OTHER_RESTAURANT_ID);
  });

  it("returns null without a profile, rather than somebody else's data", async () => {
    getProfileForCurrentUser.mockResolvedValue(null);

    expect(await getCampaignsForCurrentUser()).toBeNull();
    expect(repositoryMock.findByRestaurantId).not.toHaveBeenCalled();
  });
});

describe('updateCampaignStatus', () => {
  it("checks ownership through the session's own restaurant id, not the campaign id alone", async () => {
    await updateCampaignStatus('some-campaign-id', 'active');

    expect(repositoryMock.updateStatus).toHaveBeenCalledWith(
      'some-campaign-id',
      RESTAURANT_ID,
      'active',
    );
    // In particular, never with an id lifted from anywhere else.
    expect(repositoryMock.updateStatus).not.toHaveBeenCalledWith(
      'some-campaign-id',
      OTHER_RESTAURANT_ID,
      'active',
    );
  });

  it('does nothing when there is no profile', async () => {
    getProfileForCurrentUser.mockResolvedValue(null);

    await updateCampaignStatus('some-campaign-id', 'active');

    expect(repositoryMock.updateStatus).not.toHaveBeenCalled();
  });

  it("does not throw when the campaign does not belong to the caller's restaurant", async () => {
    repositoryMock.updateStatus.mockResolvedValue(null);

    await expect(updateCampaignStatus('someone-elses-campaign', 'completed')).resolves.toBeUndefined();
  });
});
