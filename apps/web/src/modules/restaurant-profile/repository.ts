import { eq } from 'drizzle-orm';

import { getDb } from '@/db/client';
import { restaurants } from '@/db/schema';
import type { RestaurantRepository } from '@/modules/restaurant-profile/types';

export const restaurantRepository: RestaurantRepository = {
  async findByOwnerId(ownerId) {
    const [row] = await getDb()
      .select()
      .from(restaurants)
      .where(eq(restaurants.ownerId, ownerId))
      .limit(1);

    return row ?? null;
  },

  async upsertForOwner(ownerId, input) {
    // One statement rather than select-then-branch: `owner_id` is unique, so
    // Postgres decides between insert and update and two concurrent saves
    // cannot both insert.
    const [row] = await getDb()
      .insert(restaurants)
      .values({ ...input, ownerId })
      .onConflictDoUpdate({
        target: restaurants.ownerId,
        set: { ...input, updatedAt: new Date() },
      })
      .returning();

    if (!row) {
      throw new Error('Saving the restaurant profile returned no row.');
    }

    return row;
  },
};
