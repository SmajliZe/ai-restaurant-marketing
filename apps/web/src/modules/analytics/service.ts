import type {
  AnalyticsRepository,
  AnalyticsSummary,
  ContentTypeBreakdown,
  DatedHashtagRow,
  DatedRow,
  GenerationTrendPoint,
  TopHashtag,
} from '@/modules/analytics/types';

const TREND_DAYS = 30;
const TOP_HASHTAGS_LIMIT = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * `restaurantId`'s generation activity across every content-producing
 * feature, aggregated for the analytics page.
 *
 * Each source table is read once, for its `createdAt` (and hashtags, where
 * it has them) alone - see the note on `AnalyticsRepository` for why. Every
 * count, bucket, and ranking below is then computed here in plain JS rather
 * than in SQL: this is the same split `dashboard/activity.ts` uses for its
 * cross-source merge - fetch the minimum each source can offer, then combine
 * it in pure, independently testable functions - and it keeps five small
 * tables' worth of MVP-scale data (never more than a restaurant's own
 * lifetime of generations) out of a harder-to-read multi-table SQL query,
 * without costing anything real at this traffic level.
 *
 * `now` defaults to the real current time; the parameter exists so the
 * 30-day trend and the "this month" cutoff are deterministic in tests.
 */
export async function getAnalyticsSummary(
  restaurantId: string,
  repository: AnalyticsRepository,
  now: Date = new Date(),
): Promise<AnalyticsSummary> {
  const [generatedContentRows, campaignRows, calendarRows, menuAnalysisRows, styleAnalysisRows] =
    await Promise.all([
      repository.findGeneratedContentByRestaurantId(restaurantId),
      repository.findCampaignsByRestaurantId(restaurantId),
      repository.findCalendarEntriesByRestaurantId(restaurantId),
      repository.findMenuAnalysesByRestaurantId(restaurantId),
      repository.findStyleAnalysesByRestaurantId(restaurantId),
    ]);

  const contentTypeBreakdown: ContentTypeBreakdown[] = [
    { type: 'post', count: generatedContentRows.length },
    { type: 'campaign', count: campaignRows.length },
    { type: 'calendar_entry', count: calendarRows.length },
    { type: 'menu_analysis', count: menuAnalysisRows.length },
    { type: 'style_analysis', count: styleAnalysisRows.length },
  ];

  const allDates: Date[] = [
    ...generatedContentRows.map((row) => row.createdAt),
    ...campaignRows.map((row) => row.createdAt),
    ...calendarRows.map((row) => row.createdAt),
    ...menuAnalysisRows.map((row) => row.createdAt),
    ...styleAnalysisRows.map((row) => row.createdAt),
  ];

  return {
    generationTrend: buildGenerationTrend(allDates, TREND_DAYS, now),
    contentTypeBreakdown,
    topHashtags: buildTopHashtags([...generatedContentRows, ...campaignRows], TOP_HASHTAGS_LIMIT),
    totalGenerations: allDates.length,
    generationsThisMonth: allDates.filter((date) => date >= startOfMonthUtc(now)).length,
  };
}

/**
 * The last `days` days ending on `now`'s UTC date, inclusive, with every day
 * present even at zero - a chart cannot tell "no data fetched" apart from "a
 * gap in the middle" unless every day in the range shows up.
 */
export function buildGenerationTrend(
  dates: DatedRow['createdAt'][],
  days: number,
  now: Date,
): GenerationTrendPoint[] {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const key = toDateKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const points: GenerationTrendPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = toDateKey(new Date(todayUtcMs - i * MS_PER_DAY));
    points.push({ date: key, count: counts.get(key) ?? 0 });
  }

  return points;
}

/**
 * Instagram and Facebook hashtags from generated posts, plus campaign
 * hashtags, combined and ranked. Calendar entries, menu analyses, and style
 * analyses have no hashtag column - see db/schema.ts - so they never
 * contribute here.
 *
 * Hashtags are lower-cased before counting so "Pizza" and "pizza" from
 * different generations count as the same tag rather than splitting a rank
 * that belongs together; the lower-cased form is also what is returned,
 * since once two spellings are merged there is no single "correct" casing
 * left to prefer between them.
 */
export function buildTopHashtags(rows: DatedHashtagRow[], limit: number): TopHashtag[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    for (const raw of row.hashtags) {
      const hashtag = raw.trim().toLowerCase();
      if (hashtag === '') {
        continue;
      }
      counts.set(hashtag, (counts.get(hashtag) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort(([hashtagA, countA], [hashtagB, countB]) => countB - countA || hashtagA.localeCompare(hashtagB))
    .slice(0, limit)
    .map(([hashtag, count]) => ({ hashtag, count }));
}

function startOfMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
