export type GenerationTrendPoint = {
  /** "YYYY-MM-DD", in UTC - matches how `createdAt` timestamps are compared. */
  date: string;
  count: number;
};

// Mirrors the five tables getAnalyticsSummary reads from - the display labels
// for these live in the UI layer, not here, the same split content-history
// keeps between its stored data and generated-content-result.tsx's copy.
export const CONTENT_TYPES = [
  'post',
  'campaign',
  'calendar_entry',
  'menu_analysis',
  'style_analysis',
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export type ContentTypeBreakdown = {
  type: ContentType;
  count: number;
};

export type TopHashtag = {
  hashtag: string;
  count: number;
};

export type AnalyticsSummary = {
  generationTrend: GenerationTrendPoint[];
  contentTypeBreakdown: ContentTypeBreakdown[];
  topHashtags: TopHashtag[];
  totalGenerations: number;
  generationsThisMonth: number;
};

/** What the trend and breakdown need from a row: only when it happened. */
export type DatedRow = { createdAt: Date };

/** What the hashtag ranking additionally needs: what it was tagged with. */
export type DatedHashtagRow = DatedRow & { hashtags: string[] };

/**
 * What the service needs from storage. Declared here so the service can be
 * tested against a fake and stays free of Drizzle - the same reason every
 * other module (ContentHistoryRepository, ContentCampaignRepository, ...)
 * declares its repository type alongside its other types.
 *
 * Each method returns only `createdAt` (plus `hashtags` where the table has
 * them) rather than the full row: analytics never displays an individual
 * generation, campaign, or analysis, so nothing else about it is needed here.
 */
export type AnalyticsRepository = {
  findGeneratedContentByRestaurantId: (restaurantId: string) => Promise<DatedHashtagRow[]>;
  findCampaignsByRestaurantId: (restaurantId: string) => Promise<DatedHashtagRow[]>;
  findCalendarEntriesByRestaurantId: (restaurantId: string) => Promise<DatedRow[]>;
  findMenuAnalysesByRestaurantId: (restaurantId: string) => Promise<DatedRow[]>;
  findStyleAnalysesByRestaurantId: (restaurantId: string) => Promise<DatedRow[]>;
};
