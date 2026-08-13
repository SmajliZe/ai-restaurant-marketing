import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RestaurantProfile } from '@/modules/restaurant-profile/types';

const { getProfileForCurrentUser, repositoryMock } = vi.hoisted(() => ({
  getProfileForCurrentUser: vi.fn(),
  repositoryMock: {
    replaceWeek: vi.fn(),
    findByRestaurantIdAndWeek: vi.fn(),
    toggleCompleted: vi.fn(),
  },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/modules/restaurant-profile/actions', () => ({ getProfileForCurrentUser }));
vi.mock('@/modules/content-calendar/repository', () => ({
  contentCalendarRepository: repositoryMock,
}));

const { generateWeeklyCalendar, getCalendarForCurrentWeek, toggleEntryCompleted } =
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

const CALENDAR_BODY = {
  entries: Array.from({ length: 7 }, (_, day) => ({
    day_of_week: day,
    theme: `Theme ${day}`,
    content_angle: `Content angle for day ${day}.`,
  })),
};

function respondWith(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function storedRow(dayOfWeek: number) {
  return {
    id: `row-${dayOfWeek}`,
    restaurantId: RESTAURANT_ID,
    weekStartDate: '2026-08-10',
    dayOfWeek,
    theme: `Theme ${dayOfWeek}`,
    contentAngle: `Content angle for day ${dayOfWeek}.`,
    isCompleted: false,
    createdAt: new Date(),
  };
}

beforeEach(() => {
  vi.stubEnv('AI_SERVICE_URL', AI_SERVICE_URL);
  getProfileForCurrentUser.mockResolvedValue(PROFILE);
  repositoryMock.replaceWeek.mockResolvedValue(
    Array.from({ length: 7 }, (_, day) => storedRow(day)),
  );
  repositoryMock.findByRestaurantIdAndWeek.mockResolvedValue([]);
  repositoryMock.toggleCompleted.mockResolvedValue(null);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('generateWeeklyCalendar', () => {
  it('replaces the current week with the seven generated entries', async () => {
    vi.stubGlobal('fetch', respondWith(CALENDAR_BODY));

    const result = await generateWeeklyCalendar();

    expect(result.status).toBe('generated');
    if (result.status !== 'generated') {
      throw new Error('expected generation to have succeeded');
    }
    expect(result.week.entries).toHaveLength(7);
    expect(repositoryMock.replaceWeek).toHaveBeenCalledWith(
      RESTAURANT_ID,
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ dayOfWeek: 0, theme: 'Theme 0' })]),
    );
  });

  it('posts the restaurant context as JSON', async () => {
    const fetchMock = respondWith(CALENDAR_BODY);
    vi.stubGlobal('fetch', fetchMock);

    await generateWeeklyCalendar();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${AI_SERVICE_URL}/calendar/generate`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      tone_of_voice: 'luxury',
      cuisine_type: 'Neapolitan pizza',
      country: 'Italy',
      language: 'German',
      target_audience: 'young professionals',
    });
  });

  it('is refused outright when there is no profile, and never calls the AI service', async () => {
    const fetchMock = respondWith(CALENDAR_BODY);
    vi.stubGlobal('fetch', fetchMock);
    getProfileForCurrentUser.mockResolvedValue(null);

    const result = await generateWeeklyCalendar();

    expect(result).toEqual({
      status: 'rejected',
      message:
        'Complete your restaurant profile before generating a content calendar, so we know how to plan.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(repositoryMock.replaceWeek).not.toHaveBeenCalled();
  });

  it('does not touch the stored week when the AI service call fails', async () => {
    vi.stubGlobal(
      'fetch',
      respondWith({ detail: 'AI service is temporarily busy, please try again in a moment.' }, 503),
    );

    const result = await generateWeeklyCalendar();

    expect(result).toEqual({
      status: 'rejected',
      message: 'AI service is temporarily busy, please try again in a moment.',
    });
    // A failed generation must never wipe out whatever plan already existed.
    expect(repositoryMock.replaceWeek).not.toHaveBeenCalled();
  });

  it('rejects a malformed AI response without touching the stored week', async () => {
    vi.stubGlobal('fetch', respondWith({ entries: 'not-a-list' }));

    const result = await generateWeeklyCalendar();

    expect(result).toEqual({
      status: 'rejected',
      message: 'The AI service returned an unexpected response.',
    });
    expect(repositoryMock.replaceWeek).not.toHaveBeenCalled();
  });

  it('replaces exactly this week, identified by its Monday', async () => {
    vi.stubGlobal('fetch', respondWith(CALENDAR_BODY));
    const monday = /^\d{4}-\d{2}-\d{2}$/;

    await generateWeeklyCalendar();

    const [, weekStartDate] = repositoryMock.replaceWeek.mock.calls[0] as [string, string];
    expect(weekStartDate).toMatch(monday);
  });
});

describe('getCalendarForCurrentWeek', () => {
  it("reads only the session account's own restaurant", async () => {
    await getCalendarForCurrentWeek();

    expect(repositoryMock.findByRestaurantIdAndWeek).toHaveBeenCalledWith(
      RESTAURANT_ID,
      expect.any(String),
    );
  });

  it('returns null when there is no profile', async () => {
    getProfileForCurrentUser.mockResolvedValue(null);

    expect(await getCalendarForCurrentWeek()).toBeNull();
    expect(repositoryMock.findByRestaurantIdAndWeek).not.toHaveBeenCalled();
  });

  it('returns null when nothing has been generated for the current week', async () => {
    repositoryMock.findByRestaurantIdAndWeek.mockResolvedValue([]);

    expect(await getCalendarForCurrentWeek()).toBeNull();
  });

  it('returns the stored week when one exists', async () => {
    repositoryMock.findByRestaurantIdAndWeek.mockResolvedValue([storedRow(0)]);

    const week = await getCalendarForCurrentWeek();

    expect(week?.entries).toHaveLength(1);
  });
});

describe('toggleEntryCompleted', () => {
  it("checks ownership through the session's own restaurant id, not the entry id alone", async () => {
    await toggleEntryCompleted('some-entry-id');

    expect(repositoryMock.toggleCompleted).toHaveBeenCalledWith('some-entry-id', RESTAURANT_ID);
    // In particular, never with an id lifted from anywhere else.
    expect(repositoryMock.toggleCompleted).not.toHaveBeenCalledWith(
      'some-entry-id',
      OTHER_RESTAURANT_ID,
    );
  });

  it('does nothing when there is no profile', async () => {
    getProfileForCurrentUser.mockResolvedValue(null);

    await toggleEntryCompleted('some-entry-id');

    expect(repositoryMock.toggleCompleted).not.toHaveBeenCalled();
  });

  it("does not throw when the entry does not belong to the caller's restaurant", async () => {
    repositoryMock.toggleCompleted.mockResolvedValue(null);

    await expect(toggleEntryCompleted('someone-elses-entry')).resolves.toBeUndefined();
  });
});
