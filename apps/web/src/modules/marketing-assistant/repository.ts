import { asc, eq } from 'drizzle-orm';

import { getDb } from '@/db/client';
import { assistantConversations, assistantMessages } from '@/db/schema';
import type {
  Conversation,
  ConversationMessage,
  MarketingAssistantRepository,
} from '@/modules/marketing-assistant/types';

function toConversation(row: typeof assistantConversations.$inferSelect): Conversation {
  return { id: row.id, restaurantId: row.restaurantId, createdAt: row.createdAt };
}

function toMessage(row: typeof assistantMessages.$inferSelect): ConversationMessage {
  return { id: row.id, role: row.role, content: row.content, createdAt: row.createdAt };
}

export const marketingAssistantRepository: MarketingAssistantRepository = {
  async findOrCreateConversationByRestaurantId(restaurantId) {
    // One statement for the common "first message ever" case, the same
    // reasoning restaurants.upsertForOwner uses: restaurant_id is unique, so
    // Postgres decides whether this is the insert, and two concurrent first
    // messages cannot both create a conversation. `onConflictDoNothing`
    // rather than an upsert-with-update, because there is nothing to update
    // here - a conversation has no fields of its own beyond its restaurant.
    const [inserted] = await getDb()
      .insert(assistantConversations)
      .values({ restaurantId })
      .onConflictDoNothing({ target: assistantConversations.restaurantId })
      .returning();

    if (inserted) {
      return toConversation(inserted);
    }

    const [existing] = await getDb()
      .select()
      .from(assistantConversations)
      .where(eq(assistantConversations.restaurantId, restaurantId));

    if (!existing) {
      throw new Error('Conversation lookup found nothing after a conflicting insert.');
    }

    return toConversation(existing);
  },

  async findMessagesByConversationId(conversationId) {
    const rows = await getDb()
      .select()
      .from(assistantMessages)
      .where(eq(assistantMessages.conversationId, conversationId))
      .orderBy(asc(assistantMessages.createdAt));

    return rows.map(toMessage);
  },

  async addMessage(conversationId, role, content) {
    const [row] = await getDb()
      .insert(assistantMessages)
      .values({ conversationId, role, content })
      .returning();

    if (!row) {
      throw new Error('Saving the message returned no row.');
    }

    return toMessage(row);
  },
};
