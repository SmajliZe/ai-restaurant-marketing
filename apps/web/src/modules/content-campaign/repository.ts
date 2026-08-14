import { and, desc, eq } from 'drizzle-orm';

import { getDb } from '@/db/client';
import { campaigns } from '@/db/schema';
import type { Campaign, ContentCampaignRepository } from '@/modules/content-campaign/types';

function toCampaign(row: typeof campaigns.$inferSelect): Campaign {
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    occasion: row.occasion,
    name: row.name,
    description: row.description,
    offer: row.offer,
    caption: row.caption,
    hashtags: row.hashtags,
    story: {
      text: row.storyText,
      cta: row.storyCta,
      stickerType: row.storyStickerType,
      stickerPrompt: row.storyStickerPrompt,
    },
    cta: row.cta,
    durationSuggestion: row.durationSuggestion,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const contentCampaignRepository: ContentCampaignRepository = {
  async create(restaurantId, campaign) {
    const [row] = await getDb()
      .insert(campaigns)
      .values({
        restaurantId,
        occasion: campaign.occasion,
        name: campaign.name,
        description: campaign.description,
        offer: campaign.offer,
        caption: campaign.caption,
        hashtags: campaign.hashtags,
        storyText: campaign.story.text,
        storyCta: campaign.story.cta,
        storyStickerType: campaign.story.stickerType,
        storyStickerPrompt: campaign.story.stickerPrompt,
        cta: campaign.cta,
        durationSuggestion: campaign.durationSuggestion,
      })
      .returning();

    if (!row) {
      throw new Error('Saving the campaign returned no row.');
    }

    return toCampaign(row);
  },

  async findByRestaurantId(restaurantId) {
    const rows = await getDb()
      .select()
      .from(campaigns)
      .where(eq(campaigns.restaurantId, restaurantId))
      .orderBy(desc(campaigns.createdAt));

    return rows.map(toCampaign);
  },

  async updateStatus(id, restaurantId, status) {
    // The WHERE clause is the ownership check: an id that exists but belongs
    // to a different restaurant matches zero rows here, the same as an id
    // that does not exist at all.
    const [row] = await getDb()
      .update(campaigns)
      .set({ status })
      .where(and(eq(campaigns.id, id), eq(campaigns.restaurantId, restaurantId)))
      .returning();

    return row ? toCampaign(row) : null;
  },
};
