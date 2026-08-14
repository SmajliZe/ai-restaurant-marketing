'use server';

import { revalidatePath } from 'next/cache';

import type { StickerType } from '@/modules/content-generation/types';
import { contentCampaignRepository } from '@/modules/content-campaign/repository';
import {
  createCampaign,
  getCampaigns,
  updateCampaignStatus as changeCampaignStatus,
} from '@/modules/content-campaign/service';
import type {
  Campaign,
  CampaignStatus,
  GenerateCampaignResult,
  NewCampaign,
} from '@/modules/content-campaign/types';
import { getProfileForCurrentUser } from '@/modules/restaurant-profile/actions';
import type { RestaurantProfile } from '@/modules/restaurant-profile/types';

/** Generous: building a whole campaign is one call, but still a Gemini round trip. */
const AI_REQUEST_TIMEOUT_MS = 45_000;

/**
 * Marks a message as safe and useful to show the restaurant owner. Anything
 * thrown that is not one of these is replaced with a generic message, so an
 * internal failure's own wording never reaches the page.
 */
class UserFacingError extends Error {}

const PROFILE_REQUIRED =
  'Complete your restaurant profile before generating a campaign, so we know how to write it.';

/**
 * Builds a complete campaign package for `occasion` and stores it.
 *
 * The restaurant is read from the session's own profile, never accepted as
 * an argument - the same rule `generateContent` and `generateWeeklyCalendar`
 * follow, and for the same reason: an id taken from the caller could be used
 * to write a campaign for a restaurant that is not the caller's own.
 */
export async function generateCampaign(occasion: string): Promise<GenerateCampaignResult> {
  const profile = await getProfileForCurrentUser();
  if (profile === null) {
    return { status: 'rejected', message: PROFILE_REQUIRED };
  }

  let generated: NewCampaign;
  try {
    generated = await requestCampaign(occasion, profile);
  } catch (error) {
    return { status: 'rejected', message: describeFailure(error) };
  }

  const campaign = await createCampaign(profile.id, generated, contentCampaignRepository);

  revalidatePath('/campaigns');
  revalidatePath('/dashboard');
  return { status: 'generated', campaign };
}

/** The signed-in account's own campaigns, newest first. */
export async function getCampaignsForCurrentUser(): Promise<Campaign[] | null> {
  const profile = await getProfileForCurrentUser();
  if (profile === null) {
    return null;
  }

  return getCampaigns(profile.id, contentCampaignRepository);
}

/**
 * Changes one campaign's status.
 *
 * `campaignId` arrives from the browser, so it is untrusted: ownership is
 * checked inside `changeCampaignStatus` against the session's own
 * restaurant, not assumed from the id alone. An id for someone else's
 * campaign, or one that does not exist, both quietly do nothing.
 */
export async function updateCampaignStatus(
  campaignId: string,
  status: CampaignStatus,
): Promise<void> {
  const profile = await getProfileForCurrentUser();
  if (profile === null) {
    return;
  }

  await changeCampaignStatus(campaignId, profile.id, status, contentCampaignRepository);
  revalidatePath('/campaigns');
}

type StoryPayload = {
  text: string;
  cta: string;
  sticker_type: StickerType;
  sticker_prompt: string;
};

type CampaignPayload = {
  name: string;
  description: string;
  offer: string;
  caption: string;
  hashtags: string[];
  story: StoryPayload;
  cta: string;
  duration_suggestion: string;
};

async function requestCampaign(
  occasion: string,
  profile: RestaurantProfile,
): Promise<NewCampaign> {
  const baseUrl = process.env.AI_SERVICE_URL;
  if (!baseUrl) {
    throw new UserFacingError('AI_SERVICE_URL is not configured.');
  }

  const response = await fetch(`${baseUrl}/campaign/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // snake_case: these are the AI service's field names, not ours.
    body: JSON.stringify({
      occasion,
      tone_of_voice: profile.toneOfVoice,
      cuisine_type: profile.cuisineType,
      country: profile.country,
      language: profile.language,
      target_audience: profile.targetAudience,
    }),
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    // The AI service writes its "detail" messages for end users, so they are
    // passed through rather than replaced with something vaguer.
    throw new UserFacingError(await readErrorDetail(response));
  }

  const payload: unknown = await response.json();
  if (!isCampaignPayload(payload)) {
    throw new UserFacingError('The AI service returned an unexpected response.');
  }

  return {
    occasion,
    name: payload.name,
    description: payload.description,
    offer: payload.offer,
    caption: payload.caption,
    hashtags: payload.hashtags,
    story: {
      text: payload.story.text,
      cta: payload.story.cta,
      stickerType: payload.story.sticker_type,
      stickerPrompt: payload.story.sticker_prompt,
    },
    cta: payload.cta,
    durationSuggestion: payload.duration_suggestion,
  };
}

function describeFailure(reason: unknown): string {
  if (reason instanceof UserFacingError) {
    return reason.message;
  }

  if (reason instanceof Error && reason.name === 'TimeoutError') {
    return 'The AI service took too long to respond. Try again in a moment.';
  }

  // Unexpected, so it is worth a server-side record; the owner gets the
  // generic message instead of a library's internals.
  console.error('[content-campaign] generation failed', reason);
  return 'Could not reach the AI service.';
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === 'object' && payload !== null && 'detail' in payload) {
      const { detail } = payload as { detail: unknown };
      if (typeof detail === 'string') {
        return detail;
      }
    }
  } catch {
    // Falls through to the status-based message below.
  }

  return `The AI service responded with ${response.status}.`;
}

const STICKER_TYPES: readonly StickerType[] = ['poll', 'question', 'emoji_slider', 'countdown'];

function isCampaignPayload(value: unknown): value is CampaignPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.description === 'string' &&
    typeof candidate.offer === 'string' &&
    typeof candidate.caption === 'string' &&
    isStringArray(candidate.hashtags) &&
    isStoryPayload(candidate.story) &&
    typeof candidate.cta === 'string' &&
    typeof candidate.duration_suggestion === 'string'
  );
}

function isStoryPayload(value: unknown): value is StoryPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.text === 'string' &&
    typeof candidate.cta === 'string' &&
    typeof candidate.sticker_type === 'string' &&
    STICKER_TYPES.includes(candidate.sticker_type as StickerType) &&
    typeof candidate.sticker_prompt === 'string'
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
