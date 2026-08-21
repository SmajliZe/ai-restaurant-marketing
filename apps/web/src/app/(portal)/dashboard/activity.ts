import type { CalendarDayEntry } from '@/modules/content-calendar/types';
import type { Campaign } from '@/modules/content-campaign/types';
import type { GeneratedContentEntry } from '@/modules/content-history/types';
import type { MenuAnalysis } from '@/modules/menu-analysis/types';
import type { StyleAnalysis } from '@/modules/style-analysis/types';

export type ActivityKind =
  | 'generated-content'
  | 'campaign'
  | 'calendar-entry'
  | 'menu-analysis'
  | 'style-analysis';

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  label: string;
  date: Date;
  href: string;
};

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  'generated-content': 'Post',
  campaign: 'Campaign',
  'calendar-entry': 'Calendar',
  'menu-analysis': 'Menu Analysis',
  'style-analysis': 'Style Analysis',
};

/** 5-8 items reads as a glance, not a second history page. */
const MAX_ACTIVITY_ITEMS = 8;

export type ActivitySources = {
  generatedContent: GeneratedContentEntry[];
  campaigns: Campaign[];
  calendarEntries: CalendarDayEntry[];
  menuAnalyses: MenuAnalysis[];
  styleAnalyses: StyleAnalysis[];
};

/**
 * Merges the most recent items across every generation feature into one
 * newest-first list, capped at MAX_ACTIVITY_ITEMS.
 *
 * Pure and synchronous on purpose: every source list is already fetched by
 * its own module's ownership-scoped read function (getHistoryForCurrentUser,
 * getCampaignsForCurrentUser, and so on) before this is ever called - this
 * only merges and sorts what it is given, it never queries anything itself.
 */
export function buildRecentActivity(sources: ActivitySources): ActivityItem[] {
  const items: ActivityItem[] = [
    ...sources.generatedContent.map(
      (entry): ActivityItem => ({
        id: `content-${entry.id}`,
        kind: 'generated-content',
        label: entry.recognizedDish,
        date: entry.createdAt,
        href: `/history#${entry.id}`,
      }),
    ),
    ...sources.campaigns.map(
      (campaign): ActivityItem => ({
        id: `campaign-${campaign.id}`,
        kind: 'campaign',
        label: campaign.name,
        date: campaign.createdAt,
        href: `/campaigns#${campaign.id}`,
      }),
    ),
    ...sources.calendarEntries.map(
      (entry): ActivityItem => ({
        id: `calendar-${entry.id}`,
        kind: 'calendar-entry',
        label: entry.theme,
        date: entry.createdAt,
        href: `/calendar#${entry.id}`,
      }),
    ),
    ...sources.menuAnalyses.map(
      (analysis): ActivityItem => ({
        id: `menu-analysis-${analysis.id}`,
        kind: 'menu-analysis',
        label: 'Menu analysis',
        date: analysis.createdAt,
        href: `/menu-analysis#${analysis.id}`,
      }),
    ),
    ...sources.styleAnalyses.map(
      (analysis): ActivityItem => ({
        id: `style-analysis-${analysis.id}`,
        kind: 'style-analysis',
        label: `Style analysis (${analysis.profileCount} ${
          analysis.profileCount === 1 ? 'profile' : 'profiles'
        })`,
        date: analysis.createdAt,
        href: `/style-analysis#${analysis.id}`,
      }),
    ),
  ];

  return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, MAX_ACTIVITY_ITEMS);
}
