import { describe, expect, it, vi } from 'vitest';

import { currentWeekStartDate, getWeek, replaceWeek, toggleCompleted } from './service';
import type { CalendarDayEntry, ContentCalendarRepository, NewCalendarDayEntry } from './types';

const RESTAURANT_A = '11111111-1111-4111-8111-111111111111';
const WEEK = '2026-08-10';

function makeRow(overrides: Partial<CalendarDayEntry> = {}): CalendarDayEntry {
  return {
    id: 'row-1',
    restaurantId: RESTAURANT_A,
    weekStartDate: WEEK,
    dayOfWeek: 0,
    theme: 'Theme',
    contentAngle: 'Angle.',
    isCompleted: false,
    createdAt: new Date(),
    ...overrides,
  };
}

function fakeRepository(
  overrides: Partial<ContentCalendarRepository> = {},
): ContentCalendarRepository {
  return {
    replaceWeek: vi.fn(async () => []),
    findByRestaurantIdAndWeek: vi.fn(async () => []),
    toggleCompleted: vi.fn(async () => null),
    ...overrides,
  };
}

describe('currentWeekStartDate', () => {
  it.each([
    ['2026-08-10T12:00:00Z', '2026-08-10'], // Monday -> itself
    ['2026-08-12T12:00:00Z', '2026-08-10'], // Wednesday -> that week's Monday
    ['2026-08-16T12:00:00Z', '2026-08-10'], // Sunday -> the Monday six days earlier
    ['2026-08-17T00:00:00Z', '2026-08-17'], // The following Monday
  ])('maps %s to the Monday %s', (input, expected) => {
    expect(currentWeekStartDate(new Date(input))).toBe(expected);
  });

  it('crosses a month boundary correctly', () => {
    // 2026-08-31 is a Monday; 2026-09-02 (Wednesday) belongs to that week.
    expect(currentWeekStartDate(new Date('2026-09-02T12:00:00Z'))).toBe('2026-08-31');
  });
});

describe('replaceWeek', () => {
  it('returns the new week sorted Monday through Sunday', async () => {
    const shuffledRows = [
      makeRow({ dayOfWeek: 3 }),
      makeRow({ dayOfWeek: 0 }),
      makeRow({ dayOfWeek: 6 }),
    ];
    const repository = fakeRepository({ replaceWeek: vi.fn(async () => shuffledRows) });
    const entries: NewCalendarDayEntry[] = [];

    const week = await replaceWeek(RESTAURANT_A, WEEK, entries, repository);

    expect(week.weekStartDate).toBe(WEEK);
    expect(week.entries.map((entry) => entry.dayOfWeek)).toEqual([0, 3, 6]);
  });

  it('delegates to the repository with exactly what it was given', async () => {
    const repository = fakeRepository();
    const entries: NewCalendarDayEntry[] = [
      { dayOfWeek: 0, theme: 'Theme', contentAngle: 'Angle.' },
    ];

    await replaceWeek(RESTAURANT_A, WEEK, entries, repository);

    expect(repository.replaceWeek).toHaveBeenCalledWith(RESTAURANT_A, WEEK, entries);
  });
});

describe('getWeek', () => {
  it('returns null when nothing has been generated for the week', async () => {
    const repository = fakeRepository({ findByRestaurantIdAndWeek: vi.fn(async () => []) });

    expect(await getWeek(RESTAURANT_A, WEEK, repository)).toBeNull();
  });

  it('sorts entries Monday through Sunday', async () => {
    const shuffledRows = [makeRow({ dayOfWeek: 5 }), makeRow({ dayOfWeek: 1 })];
    const repository = fakeRepository({
      findByRestaurantIdAndWeek: vi.fn(async () => shuffledRows),
    });

    const week = await getWeek(RESTAURANT_A, WEEK, repository);

    expect(week?.entries.map((entry) => entry.dayOfWeek)).toEqual([1, 5]);
  });
});

describe('toggleCompleted', () => {
  it('delegates to the repository with both the entry and restaurant ids', async () => {
    const repository = fakeRepository();

    await toggleCompleted('entry-1', RESTAURANT_A, repository);

    expect(repository.toggleCompleted).toHaveBeenCalledWith('entry-1', RESTAURANT_A);
  });

  it('returns null when the repository reports no matching row', async () => {
    const repository = fakeRepository({ toggleCompleted: vi.fn(async () => null) });

    expect(await toggleCompleted('entry-1', RESTAURANT_A, repository)).toBeNull();
  });
});
