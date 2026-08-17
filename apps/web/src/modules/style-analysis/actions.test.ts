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
vi.mock('@/modules/style-analysis/repository', () => ({
  styleAnalysisRepository: repositoryMock,
}));

const { analyzeStyle, getStyleAnalysesForCurrentUser } = await import('./actions');

const AI_SERVICE_URL = 'http://ai-service.test:8000';
const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_RESTAURANT_ID = '22222222-2222-4222-8222-222222222222';

const PROFILE = {
  id: RESTAURANT_ID,
  cuisineType: 'Neapolitan pizza',
  toneOfVoice: 'luxury',
  country: 'Italy',
  language: 'German',
  targetAudience: 'young professionals',
} as RestaurantProfile;

const ANALYSIS_BODY = {
  visual_style_notes: 'References lean on warm, low-angle lighting.',
  content_style_notes: 'Captions are short and end in a question.',
  content_pillars: ['Pillar one', 'Pillar two', 'Pillar three'],
  recommendations: ['Idea one', 'Idea two', 'Idea three'],
};

function referenceImage(name = 'feed.jpg'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/jpeg' });
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
    profileCount: 1,
    visualStyleNotes: 'References lean on warm, low-angle lighting.',
    contentStyleNotes: 'Captions are short and end in a question.',
    contentPillars: ['Pillar one', 'Pillar two', 'Pillar three'],
    recommendations: ['Idea one', 'Idea two', 'Idea three'],
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

describe('analyzeStyle', () => {
  it('stores the analysis under the current restaurant, with the profile count it was given', async () => {
    vi.stubGlobal('fetch', respondWith(ANALYSIS_BODY));

    const result = await analyzeStyle([{ feed: referenceImage(), posts: [] }]);

    expect(result.status).toBe('analyzed');
    if (result.status !== 'analyzed') {
      throw new Error('expected analysis to have succeeded');
    }
    expect(result.analysis.visualStyleNotes).toBe(
      'References lean on warm, low-angle lighting.',
    );
    expect(repositoryMock.create).toHaveBeenCalledWith(
      RESTAURANT_ID,
      expect.objectContaining({ profileCount: 1 }),
    );
  });

  it('sends each profile under its own field names, with the restaurant context', async () => {
    const fetchMock = respondWith(ANALYSIS_BODY);
    vi.stubGlobal('fetch', fetchMock);

    await analyzeStyle([
      { feed: referenceImage('feed1.jpg'), posts: [referenceImage('post1a.jpg')] },
      { feed: null, posts: [referenceImage('post2a.jpg'), referenceImage('post2b.jpg')] },
    ]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${AI_SERVICE_URL}/style-analysis/analyze`);
    expect(init.method).toBe('POST');
    const body = init.body as FormData;
    expect((body.get('profile_1_feed') as File).name).toBe('feed1.jpg');
    expect((body.get('profile_1_post_1') as File).name).toBe('post1a.jpg');
    expect(body.get('profile_2_feed')).toBeNull();
    expect((body.get('profile_2_post_1') as File).name).toBe('post2a.jpg');
    expect((body.get('profile_2_post_2') as File).name).toBe('post2b.jpg');
    expect(body.get('cuisine_type')).toBe('Neapolitan pizza');
    expect(body.get('tone_of_voice')).toBe('luxury');
    expect(body.get('country')).toBe('Italy');
    expect(body.get('language')).toBe('German');
    expect(body.get('target_audience')).toBe('young professionals');
  });

  it('drops entirely empty profile groups before building the request', async () => {
    const fetchMock = respondWith(ANALYSIS_BODY);
    vi.stubGlobal('fetch', fetchMock);

    await analyzeStyle([
      { feed: referenceImage('feed1.jpg'), posts: [] },
      { feed: null, posts: [] },
      { feed: referenceImage('feed3.jpg'), posts: [] },
    ]);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = init.body as FormData;
    // The empty middle group is skipped, so the second uploaded group
    // becomes "profile_2", not "profile_3".
    expect((body.get('profile_1_feed') as File).name).toBe('feed1.jpg');
    expect((body.get('profile_2_feed') as File).name).toBe('feed3.jpg');
    expect(body.get('profile_3_feed')).toBeNull();
  });

  it('is rejected outright when no images were uploaded at all, and never calls the AI service', async () => {
    const fetchMock = respondWith(ANALYSIS_BODY);
    vi.stubGlobal('fetch', fetchMock);

    const result = await analyzeStyle([{ feed: null, posts: [] }]);

    expect(result).toEqual({
      status: 'rejected',
      message: 'Upload at least one reference image to analyze.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(repositoryMock.create).not.toHaveBeenCalled();
  });

  it('is refused outright when there is no profile, and never calls the AI service', async () => {
    const fetchMock = respondWith(ANALYSIS_BODY);
    vi.stubGlobal('fetch', fetchMock);
    getProfileForCurrentUser.mockResolvedValue(null);

    const result = await analyzeStyle([{ feed: referenceImage(), posts: [] }]);

    expect(result).toEqual({
      status: 'rejected',
      message:
        'Complete your restaurant profile before analyzing reference profiles, so we know how to write for you.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(repositoryMock.create).not.toHaveBeenCalled();
  });

  it('stores nothing when the AI service call fails', async () => {
    vi.stubGlobal(
      'fetch',
      respondWith(
        { detail: 'AI service is temporarily busy, please try again in a moment.' },
        503,
      ),
    );

    const result = await analyzeStyle([{ feed: referenceImage(), posts: [] }]);

    expect(result).toEqual({
      status: 'rejected',
      message: 'AI service is temporarily busy, please try again in a moment.',
    });
    expect(repositoryMock.create).not.toHaveBeenCalled();
  });

  it('rejects a malformed AI response without storing anything', async () => {
    vi.stubGlobal('fetch', respondWith({ visual_style_notes: 'Only one field.' }));

    const result = await analyzeStyle([{ feed: referenceImage(), posts: [] }]);

    expect(result).toEqual({
      status: 'rejected',
      message: 'The AI service returned an unexpected response.',
    });
    expect(repositoryMock.create).not.toHaveBeenCalled();
  });
});

describe('getStyleAnalysesForCurrentUser', () => {
  it("reads only the session account's own restaurant", async () => {
    await getStyleAnalysesForCurrentUser();

    expect(repositoryMock.findByRestaurantId).toHaveBeenCalledWith(RESTAURANT_ID);
  });

  it("never queries with another account's restaurant id", async () => {
    await getStyleAnalysesForCurrentUser();

    expect(repositoryMock.findByRestaurantId).not.toHaveBeenCalledWith(OTHER_RESTAURANT_ID);
  });

  it("returns null without a profile, rather than somebody else's data", async () => {
    getProfileForCurrentUser.mockResolvedValue(null);

    expect(await getStyleAnalysesForCurrentUser()).toBeNull();
    expect(repositoryMock.findByRestaurantId).not.toHaveBeenCalled();
  });
});
