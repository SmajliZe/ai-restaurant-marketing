import type {
  FacebookContent,
  InstagramContent,
  StoryContent,
} from '@/modules/content-generation/types';

/**
 * One successful generation, as it is stored and read back.
 *
 * Nested the same way `ContentOutcome` is, rather than flattened to match the
 * database columns: the repository is the seam that maps between the two, so
 * everything above it - the dashboard, the history list, and in particular
 * `ContentPanel` from generated-content-result.tsx, which this type is built
 * to be passed straight into - works with the same shape a fresh generation
 * produces.
 */
export type GeneratedContentEntry = {
  id: string;
  restaurantId: string;
  recognizedDish: string;
  confidence: number;
  instagram: InstagramContent;
  facebook: FacebookContent;
  story: StoryContent;
  enhancedImagePath: string;
  createdAt: Date;
};

/** What `saveGeneratedContent` needs; the id and timestamp are the database's business. */
export type NewGeneratedContentEntry = Omit<
  GeneratedContentEntry,
  'id' | 'restaurantId' | 'createdAt'
>;

/**
 * What the service needs from storage. Declared here so the service can be
 * tested against a fake and stays free of Drizzle - the same reason
 * `RestaurantRepository` exists in the restaurant-profile module.
 */
export type ContentHistoryRepository = {
  create: (restaurantId: string, entry: NewGeneratedContentEntry) => Promise<GeneratedContentEntry>;
  findByRestaurantId: (
    restaurantId: string,
    limit: number,
    offset: number,
  ) => Promise<GeneratedContentEntry[]>;
  countByRestaurantId: (restaurantId: string) => Promise<number>;
  countByRestaurantIdSince: (restaurantId: string, since: Date) => Promise<number>;
};

export type HistoryPage = {
  entries: GeneratedContentEntry[];
  total: number;
  limit: number;
  offset: number;
};

export type DashboardStats = {
  totalCount: number;
  thisMonthCount: number;
  recent: GeneratedContentEntry[];
};
