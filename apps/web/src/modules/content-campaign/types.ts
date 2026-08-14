import type { StoryContent } from '@/modules/content-generation/types';

// Mirrors CAMPAIGN_STATUS_VALUES in db/schema.ts - the two never drift apart
// because both spell out the same three values by hand.
export const CAMPAIGN_STATUSES = ['draft', 'active', 'completed'] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/** One generated campaign, as it is stored and read back. */
export type Campaign = {
  id: string;
  restaurantId: string;
  occasion: string;
  name: string;
  description: string;
  offer: string;
  caption: string;
  hashtags: string[];
  story: StoryContent;
  cta: string;
  durationSuggestion: string;
  status: CampaignStatus;
  createdAt: Date;
  updatedAt: Date;
};

/** What `createCampaign` needs; the id, status and timestamps are the database's business. */
export type NewCampaign = Omit<
  Campaign,
  'id' | 'restaurantId' | 'status' | 'createdAt' | 'updatedAt'
>;

/**
 * What the service needs from storage. Declared here so the service can be
 * tested against a fake and stays free of Drizzle - the same reason
 * `ContentCalendarRepository` exists in the content-calendar module.
 */
export type ContentCampaignRepository = {
  create: (restaurantId: string, campaign: NewCampaign) => Promise<Campaign>;
  findByRestaurantId: (restaurantId: string) => Promise<Campaign[]>;
  /**
   * Updates `status` for `id`, but only if it belongs to `restaurantId`.
   *
   * Returns null when the id does not exist or belongs to a different
   * restaurant - the two are indistinguishable on purpose, so a guessed id
   * never reveals whether it was real.
   */
  updateStatus: (
    id: string,
    restaurantId: string,
    status: CampaignStatus,
  ) => Promise<Campaign | null>;
};

export type GenerateCampaignResult =
  | { status: 'generated'; campaign: Campaign }
  | { status: 'rejected'; message: string };
