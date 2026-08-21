import { describe, expect, it } from 'vitest';

import { buildGenerationTrend, buildTopHashtags, getAnalyticsSummary } from './service';
import type { AnalyticsRepository, ContentType } from './types';

const RESTAURANT_A = '11111111-1111-4111-8111-111111111111';
const RESTAURANT_B = '22222222-2222-4222-8222-222222222222';

type Row = { restaurantId: string; createdAt: Date; hashtags?: string[] };
type Table = 'generatedContent' | 'campaigns' | 'calendarEntries' | 'menuAnalyses' | 'styleAnalyses';

/**
 * A repository that actually filters by restaurant, the way the real one
 * does with a WHERE clause - see the same note in every other module's
 * service.test.ts. Each of the five tables is seeded and read back
 * independently, matching the five methods on `AnalyticsRepository`.
 */
function inMemoryRepository(): AnalyticsRepository & { seed: (table: Table, row: Row) => void } {
  const tables: Record<Table, Row[]> = {
    generatedContent: [],
    campaigns: [],
    calendarEntries: [],
    menuAnalyses: [],
    styleAnalyses: [],
  };

  function findWithHashtags(table: Table) {
    return async (restaurantId: string) =>
      tables[table]
        .filter((row) => row.restaurantId === restaurantId)
        .map((row) => ({ createdAt: row.createdAt, hashtags: row.hashtags ?? [] }));
  }

  function findDatesOnly(table: Table) {
    return async (restaurantId: string) =>
      tables[table]
        .filter((row) => row.restaurantId === restaurantId)
        .map((row) => ({ createdAt: row.createdAt }));
  }

  return {
    seed(table, row) {
      tables[table].push(row);
    },
    findGeneratedContentByRestaurantId: findWithHashtags('generatedContent'),
    findCampaignsByRestaurantId: findWithHashtags('campaigns'),
    findCalendarEntriesByRestaurantId: findDatesOnly('calendarEntries'),
    findMenuAnalysesByRestaurantId: findDatesOnly('menuAnalyses'),
    findStyleAnalysesByRestaurantId: findDatesOnly('styleAnalyses'),
  };
}

describe('getAnalyticsSummary - content type breakdown', () => {
  it('counts each of the five source tables independently', async () => {
    const repository = inMemoryRepository();
    for (let i = 0; i < 2; i += 1) {
      repository.seed('generatedContent', { restaurantId: RESTAURANT_A, createdAt: new Date() });
    }
    repository.seed('campaigns', { restaurantId: RESTAURANT_A, createdAt: new Date() });
    for (let i = 0; i < 3; i += 1) {
      repository.seed('calendarEntries', { restaurantId: RESTAURANT_A, createdAt: new Date() });
    }
    repository.seed('menuAnalyses', { restaurantId: RESTAURANT_A, createdAt: new Date() });
    for (let i = 0; i < 2; i += 1) {
      repository.seed('styleAnalyses', { restaurantId: RESTAURANT_A, createdAt: new Date() });
    }

    const summary = await getAnalyticsSummary(RESTAURANT_A, repository);

    const countOf = (type: ContentType) =>
      summary.contentTypeBreakdown.find((entry) => entry.type === type)?.count;
    expect(countOf('post')).toBe(2);
    expect(countOf('campaign')).toBe(1);
    expect(countOf('calendar_entry')).toBe(3);
    expect(countOf('menu_analysis')).toBe(1);
    expect(countOf('style_analysis')).toBe(2);
    expect(summary.totalGenerations).toBe(9);
  });

  it('reports zero, not a missing entry, for a source with nothing generated', async () => {
    const repository = inMemoryRepository();

    const summary = await getAnalyticsSummary(RESTAURANT_A, repository);

    expect(summary.contentTypeBreakdown).toEqual([
      { type: 'post', count: 0 },
      { type: 'campaign', count: 0 },
      { type: 'calendar_entry', count: 0 },
      { type: 'menu_analysis', count: 0 },
      { type: 'style_analysis', count: 0 },
    ]);
    expect(summary.totalGenerations).toBe(0);
  });
});

describe('getAnalyticsSummary - ownership', () => {
  it("never lets another restaurant's rows affect the summary", async () => {
    const repository = inMemoryRepository();
    repository.seed('generatedContent', { restaurantId: RESTAURANT_A, createdAt: new Date() });
    for (let i = 0; i < 5; i += 1) {
      repository.seed('generatedContent', { restaurantId: RESTAURANT_B, createdAt: new Date() });
      repository.seed('campaigns', {
        restaurantId: RESTAURANT_B,
        createdAt: new Date(),
        hashtags: ['someone-elses-tag'],
      });
    }

    const summary = await getAnalyticsSummary(RESTAURANT_A, repository);

    expect(summary.totalGenerations).toBe(1);
    expect(summary.contentTypeBreakdown.find((entry) => entry.type === 'post')?.count).toBe(1);
    expect(summary.topHashtags).toEqual([]);
  });

  it("is unaffected by how much another restaurant has generated", async () => {
    const repository = inMemoryRepository();
    for (let i = 0; i < 50; i += 1) {
      repository.seed('generatedContent', { restaurantId: RESTAURANT_B, createdAt: new Date() });
    }

    const summary = await getAnalyticsSummary(RESTAURANT_A, repository);

    expect(summary.totalGenerations).toBe(0);
    expect(summary.generationTrend.every((point) => point.count === 0)).toBe(true);
  });
});

describe('getAnalyticsSummary - this month', () => {
  it('counts only rows created since the start of the current month', async () => {
    const repository = inMemoryRepository();
    const now = new Date('2026-03-15T12:00:00Z');
    repository.seed('generatedContent', {
      restaurantId: RESTAURANT_A,
      createdAt: new Date('2026-03-01T00:00:00Z'),
    });
    repository.seed('generatedContent', {
      restaurantId: RESTAURANT_A,
      createdAt: new Date('2026-02-28T23:59:59Z'),
    });
    repository.seed('campaigns', {
      restaurantId: RESTAURANT_A,
      createdAt: new Date('2026-03-10T00:00:00Z'),
    });

    const summary = await getAnalyticsSummary(RESTAURANT_A, repository, now);

    expect(summary.generationsThisMonth).toBe(2);
    expect(summary.totalGenerations).toBe(3);
  });
});

describe('getAnalyticsSummary - hashtags', () => {
  it('combines hashtags from generated content and campaigns, capped at 10', async () => {
    const repository = inMemoryRepository();
    for (let i = 0; i < 12; i += 1) {
      repository.seed('generatedContent', {
        restaurantId: RESTAURANT_A,
        createdAt: new Date(),
        hashtags: [`tag${i}`],
      });
    }
    repository.seed('campaigns', {
      restaurantId: RESTAURANT_A,
      createdAt: new Date(),
      hashtags: ['tag0'],
    });
    // A hashtag-less source must never contribute to the ranking.
    repository.seed('calendarEntries', { restaurantId: RESTAURANT_A, createdAt: new Date() });

    const summary = await getAnalyticsSummary(RESTAURANT_A, repository);

    expect(summary.topHashtags).toHaveLength(10);
    expect(summary.topHashtags[0]).toEqual({ hashtag: 'tag0', count: 2 });
  });
});

describe('buildGenerationTrend', () => {
  it('fills in every day of the range, including zero-count days, rather than skipping them', () => {
    const now = new Date('2026-01-10T12:00:00Z');
    const dates = [new Date('2026-01-10T08:00:00Z'), new Date('2026-01-08T08:00:00Z')];

    const trend = buildGenerationTrend(dates, 5, now);

    expect(trend).toEqual([
      { date: '2026-01-06', count: 0 },
      { date: '2026-01-07', count: 0 },
      { date: '2026-01-08', count: 1 },
      { date: '2026-01-09', count: 0 },
      { date: '2026-01-10', count: 1 },
    ]);
  });

  it('counts multiple generations on the same day under one point', () => {
    const now = new Date('2026-01-10T12:00:00Z');
    const dates = [
      new Date('2026-01-10T01:00:00Z'),
      new Date('2026-01-10T02:00:00Z'),
      new Date('2026-01-10T03:00:00Z'),
    ];

    const trend = buildGenerationTrend(dates, 1, now);

    expect(trend).toEqual([{ date: '2026-01-10', count: 3 }]);
  });

  it('returns a flat, unbroken zero line when there is no data at all', () => {
    const now = new Date('2026-01-10T12:00:00Z');

    const trend = buildGenerationTrend([], 30, now);

    expect(trend).toHaveLength(30);
    expect(trend.every((point) => point.count === 0)).toBe(true);
    expect(trend[trend.length - 1]).toEqual({ date: '2026-01-10', count: 0 });
    expect(trend[0]).toEqual({ date: '2025-12-12', count: 0 });
  });
});

describe('buildTopHashtags', () => {
  it('combines hashtags from every row and ranks by frequency', () => {
    const rows = [
      { createdAt: new Date(), hashtags: ['pizza', 'italian'] },
      { createdAt: new Date(), hashtags: ['pizza'] },
      { createdAt: new Date(), hashtags: ['pizza', 'pasta'] },
      { createdAt: new Date(), hashtags: ['pasta'] },
    ];

    const top = buildTopHashtags(rows, 10);

    expect(top).toEqual([
      { hashtag: 'pizza', count: 3 },
      { hashtag: 'pasta', count: 2 },
      { hashtag: 'italian', count: 1 },
    ]);
  });

  it('merges the same hashtag written with different casing', () => {
    const rows = [
      { createdAt: new Date(), hashtags: ['Pizza'] },
      { createdAt: new Date(), hashtags: ['pizza'] },
      { createdAt: new Date(), hashtags: ['PIZZA'] },
    ];

    const top = buildTopHashtags(rows, 10);

    expect(top).toEqual([{ hashtag: 'pizza', count: 3 }]);
  });

  it('caps the ranking at the given limit', () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({
      createdAt: new Date(),
      hashtags: [`tag${i}`],
    }));

    const top = buildTopHashtags(rows, 10);

    expect(top).toHaveLength(10);
  });

  it('returns nothing for rows with no hashtags', () => {
    expect(buildTopHashtags([{ createdAt: new Date(), hashtags: [] }], 10)).toEqual([]);
  });
});
