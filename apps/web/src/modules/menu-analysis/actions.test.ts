import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RestaurantProfile } from '@/modules/restaurant-profile/types';

const { getProfileForCurrentUser, repositoryMock } = vi.hoisted(() => ({
  getProfileForCurrentUser: vi.fn(),
  repositoryMock: {
    create: vi.fn(),
    findByRestaurantId: vi.fn(),
  },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/modules/restaurant-profile/actions', () => ({ getProfileForCurrentUser }));
vi.mock('@/modules/menu-analysis/repository', () => ({
  menuAnalysisRepository: repositoryMock,
}));

const { analyzeMenu, getAnalysesForCurrentUser } = await import('./actions');

const AI_SERVICE_URL = 'http://ai-service.test:8000';
const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_RESTAURANT_ID = '22222222-2222-4222-8222-222222222222';

const PROFILE = {
  id: RESTAURANT_ID,
  cuisineType: 'Neapolitan pizza',
  country: 'Italy',
  language: 'German',
  targetAudience: 'young professionals',
} as RestaurantProfile;

const ANALYSIS_BODY = {
  overview: 'A single-page Italian dinner menu.',
  pricing_notes: 'Pizzas range from 9 to 14 EUR.',
  description_quality: 'Starter descriptions are appetising.',
  upselling_ideas: ['Idea one.', 'Idea two.', 'Idea three.'],
  cross_selling_ideas: ['Pair one.', 'Pair two.', 'Pair three.'],
  missing_items: [],
  improvement_suggestions: ['Fix one.', 'Fix two.', 'Fix three.'],
};

function menuFile(): File {
  return new File([new Uint8Array([1, 2, 3])], 'menu.jpg', { type: 'image/jpeg' });
}

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
    overview: 'A single-page Italian dinner menu.',
    pricingNotes: 'Pizzas range from 9 to 14 EUR.',
    descriptionQuality: 'Starter descriptions are appetising.',
    upsellingIdeas: ['Idea one.', 'Idea two.', 'Idea three.'],
    crossSellingIdeas: ['Pair one.', 'Pair two.', 'Pair three.'],
    missingItems: [],
    improvementSuggestions: ['Fix one.', 'Fix two.', 'Fix three.'],
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv('AI_SERVICE_URL', AI_SERVICE_URL);
  getProfileForCurrentUser.mockResolvedValue(PROFILE);
  repositoryMock.create.mockResolvedValue(storedRow());
  repositoryMock.findByRestaurantId.mockResolvedValue([]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('analyzeMenu', () => {
  it('stores the analysis under the current restaurant', async () => {
    vi.stubGlobal('fetch', respondWith(ANALYSIS_BODY));

    const result = await analyzeMenu(menuFile());

    expect(result.status).toBe('analyzed');
    if (result.status !== 'analyzed') {
      throw new Error('expected analysis to have succeeded');
    }
    expect(result.analysis.overview).toBe('A single-page Italian dinner menu.');
    expect(repositoryMock.create).toHaveBeenCalledWith(
      RESTAURANT_ID,
      expect.objectContaining({ overview: 'A single-page Italian dinner menu.' }),
    );
  });

  it('posts the image and restaurant context as multipart form data, with no tone of voice', async () => {
    const fetchMock = respondWith(ANALYSIS_BODY);
    vi.stubGlobal('fetch', fetchMock);

    await analyzeMenu(menuFile());

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${AI_SERVICE_URL}/menu-analysis/analyze`);
    expect(init.method).toBe('POST');
    const body = init.body as FormData;
    expect(body.get('cuisine_type')).toBe('Neapolitan pizza');
    expect(body.get('country')).toBe('Italy');
    expect(body.get('language')).toBe('German');
    expect(body.get('target_audience')).toBe('young professionals');
    expect(body.get('tone_of_voice')).toBeNull();
    expect(body.get('image')).toBeInstanceOf(File);
  });

  it('is refused outright when there is no profile, and never calls the AI service', async () => {
    const fetchMock = respondWith(ANALYSIS_BODY);
    vi.stubGlobal('fetch', fetchMock);
    getProfileForCurrentUser.mockResolvedValue(null);

    const result = await analyzeMenu(menuFile());

    expect(result).toEqual({
      status: 'rejected',
      message:
        'Complete your restaurant profile before analyzing a menu, so we know how to give feedback.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(repositoryMock.create).not.toHaveBeenCalled();
  });

  it('stores nothing when the AI service call fails', async () => {
    vi.stubGlobal(
      'fetch',
      respondWith({ detail: 'AI service is temporarily busy, please try again in a moment.' }, 503),
    );

    const result = await analyzeMenu(menuFile());

    expect(result).toEqual({
      status: 'rejected',
      message: 'AI service is temporarily busy, please try again in a moment.',
    });
    expect(repositoryMock.create).not.toHaveBeenCalled();
  });

  it('rejects a malformed AI response without storing anything', async () => {
    vi.stubGlobal('fetch', respondWith({ overview: 'Only an overview, nothing else.' }));

    const result = await analyzeMenu(menuFile());

    expect(result).toEqual({
      status: 'rejected',
      message: 'The AI service returned an unexpected response.',
    });
    expect(repositoryMock.create).not.toHaveBeenCalled();
  });
});

describe('getAnalysesForCurrentUser', () => {
  it("reads only the session account's own restaurant", async () => {
    await getAnalysesForCurrentUser();

    expect(repositoryMock.findByRestaurantId).toHaveBeenCalledWith(RESTAURANT_ID);
  });

  it("never queries with another account's restaurant id", async () => {
    await getAnalysesForCurrentUser();

    expect(repositoryMock.findByRestaurantId).not.toHaveBeenCalledWith(OTHER_RESTAURANT_ID);
  });

  it("returns null without a profile, rather than somebody else's data", async () => {
    getProfileForCurrentUser.mockResolvedValue(null);

    expect(await getAnalysesForCurrentUser()).toBeNull();
    expect(repositoryMock.findByRestaurantId).not.toHaveBeenCalled();
  });
});
