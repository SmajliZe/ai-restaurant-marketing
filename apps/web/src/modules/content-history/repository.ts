import { and, desc, eq, gte, sql } from 'drizzle-orm';

import { getDb } from '@/db/client';
import { generatedContent } from '@/db/schema';
import type {
  ContentHistoryRepository,
  GeneratedContentEntry,
} from '@/modules/content-history/types';

function toEntry(row: typeof generatedContent.$inferSelect): GeneratedContentEntry {
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    recognizedDish: row.recognizedDish,
    confidence: row.confidence,
    instagram: { caption: row.instagramCaption, hashtags: row.instagramHashtags },
    facebook: { post: row.facebookPost, hashtags: row.facebookHashtags },
    story: {
      text: row.storyText,
      cta: row.storyCta,
      stickerType: row.storyStickerType,
      stickerPrompt: row.storyStickerPrompt,
    },
    enhancedImagePath: row.enhancedImagePath,
    createdAt: row.createdAt,
  };
}

export const contentHistoryRepository: ContentHistoryRepository = {
  async create(restaurantId, entry) {
    const [row] = await getDb()
      .insert(generatedContent)
      .values({
        restaurantId,
        recognizedDish: entry.recognizedDish,
        confidence: entry.confidence,
        instagramCaption: entry.instagram.caption,
        instagramHashtags: entry.instagram.hashtags,
        facebookPost: entry.facebook.post,
        facebookHashtags: entry.facebook.hashtags,
        storyText: entry.story.text,
        storyCta: entry.story.cta,
        storyStickerType: entry.story.stickerType,
        storyStickerPrompt: entry.story.stickerPrompt,
        enhancedImagePath: entry.enhancedImagePath,
      })
      .returning();

    if (!row) {
      throw new Error('Saving generated content returned no row.');
    }

    return toEntry(row);
  },

  async findByRestaurantId(restaurantId, limit, offset) {
    const rows = await getDb()
      .select()
      .from(generatedContent)
      .where(eq(generatedContent.restaurantId, restaurantId))
      .orderBy(desc(generatedContent.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map(toEntry);
  },

  async countByRestaurantId(restaurantId) {
    const [row] = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(generatedContent)
      .where(eq(generatedContent.restaurantId, restaurantId));

    return row?.count ?? 0;
  },

  async countByRestaurantIdSince(restaurantId, since) {
    const [row] = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.restaurantId, restaurantId),
          gte(generatedContent.createdAt, since),
        ),
      );

    return row?.count ?? 0;
  },
};
