import { describe, expect, it } from 'vitest';

import { getDashboardStats, getHistory, saveGeneratedContent } from './service';
import type {
  ContentHistoryRepository,
  GeneratedContentEntry,
  NewGeneratedContentEntry,
} from './types';

const RESTAURANT_A = '11111111-1111-4111-8111-111111111111';
const RESTAURANT_B = '22222222-2222-4222-8222-222222222222';

function makeEntry(overrides: Partial<NewGeneratedContentEntry> = {}): NewGeneratedContentEntry {
  return {
    recognizedDish: 'Margherita pizza',
    confidence: 0.9,
    instagram: { caption: 'caption', hashtags: ['pizza'] },
    facebook: { post: 'post', hashtags: [] },
    story: { text: 'text', cta: 'cta', stickerType: 'poll', stickerPrompt: 'prompt' },
    enhancedImagePath: '/api/enhanced-images/abc.jpg',
    ...overrides,
  };
}

function makeRow(overrides: Partial<GeneratedContentEntry> = {}): GeneratedContentEntry {
  return {
    id: crypto.randomUUID(),
    restaurantId: RESTAURANT_A,
    createdAt: new Date(),
    ...makeEntry(),
    ...overrides,
  };
}

/**
 * A repository that actually filters by restaurant, the way the real one
 * does with a WHERE clause. A fake that only recorded call arguments would
 * not catch a query that quietly ignored `restaurantId` and returned
 * everyone's rows.
 */
function inMemoryRepository(): ContentHistoryRepository & {
  seed: (row: GeneratedContentEntry) => void;
} {
  const rows: GeneratedContentEntry[] = [];

  return {
    seed(row) {
      rows.push(row);
    },
    async create(restaurantId, entry) {
      const row: GeneratedContentEntry = {
        id: crypto.randomUUID(),
        restaurantId,
        createdAt: new Date(),
        ...entry,
      };
      rows.push(row);
      return row;
    },
    async findByRestaurantId(restaurantId, limit, offset) {
      return rows
        .filter((row) => row.restaurantId === restaurantId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(offset, offset + limit);
    },
    async countByRestaurantId(restaurantId) {
      return rows.filter((row) => row.restaurantId === restaurantId).length;
    },
    async countByRestaurantIdSince(restaurantId, since) {
      return rows.filter((row) => row.restaurantId === restaurantId && row.createdAt >= since)
        .length;
    },
  };
}

describe('saveGeneratedContent', () => {
  it('stores the row under the given restaurant', async () => {
    const repository = inMemoryRepository();

    const saved = await saveGeneratedContent(RESTAURANT_A, makeEntry(), repository);

    expect(saved.restaurantId).toBe(RESTAURANT_A);
    expect(saved.recognizedDish).toBe('Margherita pizza');
    expect(saved.id).toBeTruthy();
  });
});

describe('getHistory - ownership', () => {
  it("never returns another restaurant's rows", async () => {
    const repository = inMemoryRepository();
    await saveGeneratedContent(RESTAURANT_A, makeEntry({ recognizedDish: 'A dish' }), repository);
    await saveGeneratedContent(RESTAURANT_B, makeEntry({ recognizedDish: 'B dish' }), repository);

    const page = await getHistory(RESTAURANT_A, 10, 0, repository);

    expect(page.entries).toHaveLength(1);
    expect(page.entries[0]?.recognizedDish).toBe('A dish');
    expect(page.total).toBe(1);
  });

  it('is unaffected by how much history another restaurant has', async () => {
    const repository = inMemoryRepository();
    for (let i = 0; i < 20; i += 1) {
      await saveGeneratedContent(RESTAURANT_B, makeEntry(), repository);
    }

    const page = await getHistory(RESTAURANT_A, 10, 0, repository);

    expect(page).toEqual({ entries: [], total: 0, limit: 10, offset: 0 });
  });
});

describe('getHistory - pagination boundaries', () => {
  it('returns an empty page for a restaurant with no history', async () => {
    const repository = inMemoryRepository();

    const page = await getHistory(RESTAURANT_A, 10, 0, repository);

    expect(page).toEqual({ entries: [], total: 0, limit: 10, offset: 0 });
  });

  it('returns exactly one page when the row count equals the page size', async () => {
    const repository = inMemoryRepository();
    for (let i = 0; i < 10; i += 1) {
      await saveGeneratedContent(RESTAURANT_A, makeEntry(), repository);
    }

    const page = await getHistory(RESTAURANT_A, 10, 0, repository);

    expect(page.entries).toHaveLength(10);
    expect(page.total).toBe(10);
  });

  it('returns a partial last page', async () => {
    const repository = inMemoryRepository();
    for (let i = 0; i < 12; i += 1) {
      await saveGeneratedContent(RESTAURANT_A, makeEntry(), repository);
    }

    const firstPage = await getHistory(RESTAURANT_A, 10, 0, repository);
    const secondPage = await getHistory(RESTAURANT_A, 10, 10, repository);

    expect(firstPage.entries).toHaveLength(10);
    expect(secondPage.entries).toHaveLength(2);
    expect(firstPage.total).toBe(12);
    expect(secondPage.total).toBe(12);
  });

  it('returns an empty page for an offset past the end', async () => {
    const repository = inMemoryRepository();
    await saveGeneratedContent(RESTAURANT_A, makeEntry(), repository);

    const page = await getHistory(RESTAURANT_A, 10, 10, repository);

    expect(page.entries).toEqual([]);
    expect(page.total).toBe(1);
  });

  it('orders newest first', async () => {
    const repository = inMemoryRepository();
    repository.seed(
      makeRow({ recognizedDish: 'Oldest', createdAt: new Date('2024-01-01T00:00:00Z') }),
    );
    repository.seed(
      makeRow({ recognizedDish: 'Newest', createdAt: new Date('2024-06-01T00:00:00Z') }),
    );
    repository.seed(
      makeRow({ recognizedDish: 'Middle', createdAt: new Date('2024-03-01T00:00:00Z') }),
    );

    const page = await getHistory(RESTAURANT_A, 10, 0, repository);

    expect(page.entries.map((entry) => entry.recognizedDish)).toEqual([
      'Newest',
      'Middle',
      'Oldest',
    ]);
  });
});

describe('getDashboardStats', () => {
  it('counts total and this-month generations, and lists at most the 5 most recent', async () => {
    const repository = inMemoryRepository();
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);

    repository.seed(makeRow({ createdAt: lastMonth }));
    repository.seed(makeRow({ createdAt: lastMonth }));
    for (let i = 0; i < 6; i += 1) {
      repository.seed(makeRow({ createdAt: now, recognizedDish: `This month ${i}` }));
    }
    // A different restaurant's activity must never affect these numbers.
    repository.seed(makeRow({ restaurantId: RESTAURANT_B, createdAt: now }));

    const stats = await getDashboardStats(RESTAURANT_A, repository);

    expect(stats.totalCount).toBe(8);
    expect(stats.thisMonthCount).toBe(6);
    expect(stats.recent).toHaveLength(5);
    expect(stats.recent.every((entry) => entry.restaurantId === RESTAURANT_A)).toBe(true);
  });

  it('returns zeroes and an empty recent list for a restaurant with no history', async () => {
    const repository = inMemoryRepository();

    const stats = await getDashboardStats(RESTAURANT_A, repository);

    expect(stats).toEqual({ totalCount: 0, thisMonthCount: 0, recent: [] });
  });
});
