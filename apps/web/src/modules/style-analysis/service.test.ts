import { describe, expect, it } from 'vitest';

import { getStyleAnalyses, saveStyleAnalysis } from './service';
import type { NewStyleAnalysis, StyleAnalysis, StyleAnalysisRepository } from './types';

const RESTAURANT_A = '11111111-1111-4111-8111-111111111111';
const RESTAURANT_B = '22222222-2222-4222-8222-222222222222';

function makeAnalysis(overrides: Partial<NewStyleAnalysis> = {}): NewStyleAnalysis {
  return {
    profileCount: 2,
    visualStyleNotes: 'References lean on warm, low-angle lighting.',
    contentStyleNotes: 'Captions are short and end in a question.',
    contentPillars: ['Pillar one', 'Pillar two', 'Pillar three'],
    recommendations: ['Idea one', 'Idea two', 'Idea three'],
    ...overrides,
  };
}

function makeRow(overrides: Partial<StyleAnalysis> = {}): StyleAnalysis {
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
function inMemoryRepository(): StyleAnalysisRepository & { seed: (row: StyleAnalysis) => void } {
  const rows: StyleAnalysis[] = [];

  return {
    seed(row) {
      rows.push(row);
    },
    async create(restaurantId, analysis) {
      const row: StyleAnalysis = {
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

describe('saveStyleAnalysis', () => {
  it('stores the analysis under the given restaurant', async () => {
    const repository = inMemoryRepository();

    const saved = await saveStyleAnalysis(RESTAURANT_A, makeAnalysis(), repository);

    expect(saved.restaurantId).toBe(RESTAURANT_A);
    expect(saved.visualStyleNotes).toBe('References lean on warm, low-angle lighting.');
    expect(saved.id).toBeTruthy();
  });

  it('stores the profile count it was given', async () => {
    const repository = inMemoryRepository();

    const saved = await saveStyleAnalysis(
      RESTAURANT_A,
      makeAnalysis({ profileCount: 3 }),
      repository,
    );

    expect(saved.profileCount).toBe(3);
  });
});

describe('getStyleAnalyses - ownership', () => {
  it("never returns another restaurant's analyses", async () => {
    const repository = inMemoryRepository();
    await saveStyleAnalysis(
      RESTAURANT_A,
      makeAnalysis({ visualStyleNotes: 'A notes' }),
      repository,
    );
    await saveStyleAnalysis(
      RESTAURANT_B,
      makeAnalysis({ visualStyleNotes: 'B notes' }),
      repository,
    );

    const analyses = await getStyleAnalyses(RESTAURANT_A, repository);

    expect(analyses).toHaveLength(1);
    expect(analyses[0]?.visualStyleNotes).toBe('A notes');
  });

  it('is unaffected by how many analyses another restaurant has', async () => {
    const repository = inMemoryRepository();
    for (let i = 0; i < 20; i += 1) {
      await saveStyleAnalysis(RESTAURANT_B, makeAnalysis(), repository);
    }

    expect(await getStyleAnalyses(RESTAURANT_A, repository)).toEqual([]);
  });

  it('orders newest first', async () => {
    const repository = inMemoryRepository();
    repository.seed(
      makeRow({ visualStyleNotes: 'Oldest', createdAt: new Date('2024-01-01T00:00:00Z') }),
    );
    repository.seed(
      makeRow({ visualStyleNotes: 'Newest', createdAt: new Date('2024-06-01T00:00:00Z') }),
    );
    repository.seed(
      makeRow({ visualStyleNotes: 'Middle', createdAt: new Date('2024-03-01T00:00:00Z') }),
    );

    const analyses = await getStyleAnalyses(RESTAURANT_A, repository);

    expect(analyses.map((analysis) => analysis.visualStyleNotes)).toEqual([
      'Newest',
      'Middle',
      'Oldest',
    ]);
  });

  it('returns an empty list for a restaurant with no analyses', async () => {
    const repository = inMemoryRepository();

    expect(await getStyleAnalyses(RESTAURANT_A, repository)).toEqual([]);
  });
});
