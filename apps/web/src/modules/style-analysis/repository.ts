import { desc, eq } from 'drizzle-orm';

import { getDb } from '@/db/client';
import { styleAnalyses } from '@/db/schema';
import type { StyleAnalysis, StyleAnalysisRepository } from '@/modules/style-analysis/types';

function toAnalysis(row: typeof styleAnalyses.$inferSelect): StyleAnalysis {
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    profileCount: row.profileCount,
    visualStyleNotes: row.visualStyleNotes,
    contentStyleNotes: row.contentStyleNotes,
    contentPillars: row.contentPillars,
    recommendations: row.recommendations,
    createdAt: row.createdAt,
  };
}

export const styleAnalysisRepository: StyleAnalysisRepository = {
  async create(restaurantId, analysis) {
    const [row] = await getDb()
      .insert(styleAnalyses)
      .values({
        restaurantId,
        profileCount: analysis.profileCount,
        visualStyleNotes: analysis.visualStyleNotes,
        contentStyleNotes: analysis.contentStyleNotes,
        contentPillars: analysis.contentPillars,
        recommendations: analysis.recommendations,
      })
      .returning();

    if (!row) {
      throw new Error('Saving the style analysis returned no row.');
    }

    return toAnalysis(row);
  },

  async findByRestaurantId(restaurantId) {
    const rows = await getDb()
      .select()
      .from(styleAnalyses)
      .where(eq(styleAnalyses.restaurantId, restaurantId))
      .orderBy(desc(styleAnalyses.createdAt));

    return rows.map(toAnalysis);
  },
};
