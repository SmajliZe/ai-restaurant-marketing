import { describe, expect, it } from 'vitest';

import { getMenuAnalyses, saveMenuAnalysis } from './service';
import type { MenuAnalysis, MenuAnalysisRepository, NewMenuAnalysis } from './types';

const RESTAURANT_A = '11111111-1111-4111-8111-111111111111';
const RESTAURANT_B = '22222222-2222-4222-8222-222222222222';

function makeAnalysis(overrides: Partial<NewMenuAnalysis> = {}): NewMenuAnalysis {
  return {
    overview: 'A single-page Italian dinner menu.',
    pricingNotes: 'Pizzas range from 9 to 14 EUR.',
    descriptionQuality: 'Starter descriptions are appetising.',
    upsellingIdeas: ['Idea one.', 'Idea two.', 'Idea three.'],
    crossSellingIdeas: ['Pair one.', 'Pair two.', 'Pair three.'],
    missingItems: [],
    improvementSuggestions: ['Fix one.', 'Fix two.', 'Fix three.'],
    ...overrides,
  };
}

function makeRow(overrides: Partial<MenuAnalysis> = {}): MenuAnalysis {
  return {
    id: crypto.randomUUID(),
    restaurantId: RESTAURANT_A,
    createdAt: new Date(),
    ...makeAnalysis(),
    ...overrides,
  };
}

/**
 * A repository that actually filters by restaurant, the way the real one
 * does with a WHERE clause. A fake that only recorded call arguments would
 * not catch a query that quietly ignored `restaurantId` and returned
 * everyone's rows - see the same note in content-history's service.test.ts.
 */
function inMemoryRepository(): MenuAnalysisRepository & { seed: (row: MenuAnalysis) => void } {
  const rows: MenuAnalysis[] = [];

  return {
    seed(row) {
      rows.push(row);
    },
    async create(restaurantId, analysis) {
      const row: MenuAnalysis = {
        id: crypto.randomUUID(),
        restaurantId,
        createdAt: new Date(),
        ...analysis,
      };
      rows.push(row);
      return row;
    },
    async findByRestaurantId(restaurantId) {
      return rows
        .filter((row) => row.restaurantId === restaurantId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
  };
}

describe('saveMenuAnalysis', () => {
  it('stores the analysis under the given restaurant', async () => {
    const repository = inMemoryRepository();

    const saved = await saveMenuAnalysis(RESTAURANT_A, makeAnalysis(), repository);

    expect(saved.restaurantId).toBe(RESTAURANT_A);
    expect(saved.overview).toBe('A single-page Italian dinner menu.');
    expect(saved.id).toBeTruthy();
  });

  it('stores an empty missing_items list as-is', async () => {
    const repository = inMemoryRepository();

    const saved = await saveMenuAnalysis(
      RESTAURANT_A,
      makeAnalysis({ missingItems: [] }),
      repository,
    );

    expect(saved.missingItems).toEqual([]);
  });
});

describe('getMenuAnalyses - ownership', () => {
  it("never returns another restaurant's analyses", async () => {
    const repository = inMemoryRepository();
    await saveMenuAnalysis(RESTAURANT_A, makeAnalysis({ overview: 'A overview' }), repository);
    await saveMenuAnalysis(RESTAURANT_B, makeAnalysis({ overview: 'B overview' }), repository);

    const analyses = await getMenuAnalyses(RESTAURANT_A, repository);

    expect(analyses).toHaveLength(1);
    expect(analyses[0]?.overview).toBe('A overview');
  });

  it('is unaffected by how many analyses another restaurant has', async () => {
    const repository = inMemoryRepository();
    for (let i = 0; i < 20; i += 1) {
      await saveMenuAnalysis(RESTAURANT_B, makeAnalysis(), repository);
    }

    expect(await getMenuAnalyses(RESTAURANT_A, repository)).toEqual([]);
  });

  it('orders newest first', async () => {
    const repository = inMemoryRepository();
    repository.seed(makeRow({ overview: 'Oldest', createdAt: new Date('2024-01-01T00:00:00Z') }));
    repository.seed(makeRow({ overview: 'Newest', createdAt: new Date('2024-06-01T00:00:00Z') }));
    repository.seed(makeRow({ overview: 'Middle', createdAt: new Date('2024-03-01T00:00:00Z') }));

    const analyses = await getMenuAnalyses(RESTAURANT_A, repository);

    expect(analyses.map((analysis) => analysis.overview)).toEqual([
      'Newest',
      'Middle',
      'Oldest',
    ]);
  });

  it('returns an empty list for a restaurant with no analyses', async () => {
    const repository = inMemoryRepository();

    expect(await getMenuAnalyses(RESTAURANT_A, repository)).toEqual([]);
  });
});
