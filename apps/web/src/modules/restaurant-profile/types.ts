import type { RestaurantRow, ToneOfVoice, WeeklyOpeningHours } from '@/db/schema';

export type { ToneOfVoice, WeeklyOpeningHours };

export type RestaurantProfile = RestaurantRow;

/**
 * The fields a form can set.
 *
 * `id`, `ownerId` and the timestamps are absent on purpose: the owner comes
 * from the session and the rest are the database's business, so there is no
 * shape in which a request could carry them.
 */
export type RestaurantProfileInput = Omit<
  RestaurantRow,
  'id' | 'ownerId' | 'createdAt' | 'updatedAt'
>;

/**
 * What the service needs from storage. Declared here so the service can be
 * tested against a fake and stays free of Drizzle.
 */
export type RestaurantRepository = {
  findByOwnerId: (ownerId: string) => Promise<RestaurantProfile | null>;
  upsertForOwner: (ownerId: string, input: RestaurantProfileInput) => Promise<RestaurantProfile>;
};

export type SaveProfileResult =
  | { status: 'saved' }
  | { status: 'invalid'; message: string }
  | { status: 'unauthenticated'; message: string };
