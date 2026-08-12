import type {
  ContentHistoryRepository,
  DashboardStats,
  GeneratedContentEntry,
  HistoryPage,
  NewGeneratedContentEntry,
} from '@/modules/content-history/types';

const RECENT_COUNT = 5;

/**
 * Records one successful generation against `restaurantId`.
 *
 * The id is a parameter rather than something resolved in here: the caller
 * (the content generation action) already has it from the session-bound
 * profile it just used to make the AI call, and re-deriving it from the
 * session a second time here would only be a second trust boundary to keep
 * in sync with the first.
 */
export async function saveGeneratedContent(
  restaurantId: string,
  entry: NewGeneratedContentEntry,
  repository: ContentHistoryRepository,
): Promise<GeneratedContentEntry> {
  return repository.create(restaurantId, entry);
}

/** A page of `restaurantId`'s history, newest first. */
export async function getHistory(
  restaurantId: string,
  limit: number,
  offset: number,
  repository: ContentHistoryRepository,
): Promise<HistoryPage> {
  const [entries, total] = await Promise.all([
    repository.findByRestaurantId(restaurantId, limit, offset),
    repository.countByRestaurantId(restaurantId),
  ]);

  return { entries, total, limit, offset };
}

/** Summary stats for `restaurantId`: totals, and the most recent entries. */
export async function getDashboardStats(
  restaurantId: string,
  repository: ContentHistoryRepository,
): Promise<DashboardStats> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [totalCount, thisMonthCount, recent] = await Promise.all([
    repository.countByRestaurantId(restaurantId),
    repository.countByRestaurantIdSince(restaurantId, startOfMonth),
    repository.findByRestaurantId(restaurantId, RECENT_COUNT, 0),
  ]);

  return { totalCount, thisMonthCount, recent };
}
