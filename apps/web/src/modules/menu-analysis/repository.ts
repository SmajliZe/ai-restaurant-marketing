import { desc, eq } from 'drizzle-orm';

import { getDb } from '@/db/client';
import { menuAnalyses } from '@/db/schema';
import type { MenuAnalysis, MenuAnalysisRepository } from '@/modules/menu-analysis/types';

function toAnalysis(row: typeof menuAnalyses.$inferSelect): MenuAnalysis {
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    overview: row.overview,
    pricingNotes: row.pricingNotes,
    descriptionQuality: row.descriptionQuality,
    upsellingIdeas: row.upsellingIdeas,
    crossSellingIdeas: row.crossSellingIdeas,
    missingItems: row.missingItems,
    improvementSuggestions: row.improvementSuggestions,
    createdAt: row.createdAt,
  };
}

export const menuAnalysisRepository: MenuAnalysisRepository = {
  async create(restaurantId, analysis) {
    const [row] = await getDb()
      .insert(menuAnalyses)
      .values({
        restaurantId,
        overview: analysis.overview,
        pricingNotes: analysis.pricingNotes,
        descriptionQuality: analysis.descriptionQuality,
        upsellingIdeas: analysis.upsellingIdeas,
        crossSellingIdeas: analysis.crossSellingIdeas,
        missingItems: analysis.missingItems,
        improvementSuggestions: analysis.improvementSuggestions,
      })
      .returning();

    if (!row) {
      throw new Error('Saving the menu analysis returned no row.');
    }

    return toAnalysis(row);
  },

  async findByRestaurantId(restaurantId) {
    const rows = await getDb()
      .select()
      .from(menuAnalyses)
      .where(eq(menuAnalyses.restaurantId, restaurantId))
      .orderBy(desc(menuAnalyses.createdAt));

    return rows.map(toAnalysis);
  },
};
