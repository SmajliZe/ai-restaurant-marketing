import type {
  Campaign,
  CampaignStatus,
  ContentCampaignRepository,
  NewCampaign,
} from '@/modules/content-campaign/types';

/** Stores a freshly generated campaign under `restaurantId`. */
export async function createCampaign(
  restaurantId: string,
  campaign: NewCampaign,
  repository: ContentCampaignRepository,
): Promise<Campaign> {
  return repository.create(restaurantId, campaign);
}

/** `restaurantId`'s own campaigns, newest first. */
export async function getCampaigns(
  restaurantId: string,
  repository: ContentCampaignRepository,
): Promise<Campaign[]> {
  return repository.findByRestaurantId(restaurantId);
}

/**
 * Changes one campaign's status, but only if it belongs to `restaurantId` -
 * see `ContentCampaignRepository.updateStatus`.
 */
export async function updateCampaignStatus(
  campaignId: string,
  restaurantId: string,
  status: CampaignStatus,
  repository: ContentCampaignRepository,
): Promise<Campaign | null> {
  return repository.updateStatus(campaignId, restaurantId, status);
}
