import { eq } from 'drizzle-orm';

import { getDb } from '@/db/client';
import {
  calendarEntries,
  campaigns,
  generatedContent,
  menuAnalyses,
  styleAnalyses,
} from '@/db/schema';
import type { AnalyticsRepository } from '@/modules/analytics/types';

export const analyticsRepository: AnalyticsRepository = {
  async findGeneratedContentByRestaurantId(restaurantId) {
    const rows = await getDb()
      .select({
        createdAt: generatedContent.createdAt,
        instagramHashtags: generatedContent.instagramHashtags,
        facebookHashtags: generatedContent.facebookHashtags,
      })
      .from(generatedContent)
      .where(eq(generatedContent.restaurantId, restaurantId));

    return rows.map((row) => ({
      createdAt: row.createdAt,
      hashtags: [...row.instagramHashtags, ...row.facebookHashtags],
    }));
  },

  async findCampaignsByRestaurantId(restaurantId) {
    return getDb()
      .select({ createdAt: campaigns.createdAt, hashtags: campaigns.hashtags })
      .from(campaigns)
      .where(eq(campaigns.restaurantId, restaurantId));
  },

  async findCalendarEntriesByRestaurantId(restaurantId) {
    return getDb()
      .select({ createdAt: calendarEntries.createdAt })
      .from(calendarEntries)
      .where(eq(calendarEntries.restaurantId, restaurantId));
  },

  async findMenuAnalysesByRestaurantId(restaurantId) {
    return getDb()
      .select({ createdAt: menuAnalyses.createdAt })
      .from(menuAnalyses)
      .where(eq(menuAnalyses.restaurantId, restaurantId));
  },

  async findStyleAnalysesByRestaurantId(restaurantId) {
    return getDb()
      .select({ createdAt: styleAnalyses.createdAt })
      .from(styleAnalyses)
      .where(eq(styleAnalyses.restaurantId, restaurantId));
  },
};
