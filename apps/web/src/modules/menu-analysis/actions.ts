'use server';

import { revalidatePath } from 'next/cache';

import { menuAnalysisRepository } from '@/modules/menu-analysis/repository';
import { getMenuAnalyses, saveMenuAnalysis } from '@/modules/menu-analysis/service';
import type {
  AnalyzeMenuResult,
  MenuAnalysis,
  NewMenuAnalysis,
} from '@/modules/menu-analysis/types';
import { getProfileForCurrentUser } from '@/modules/restaurant-profile/actions';
import type { RestaurantProfile } from '@/modules/restaurant-profile/types';

/** Generous: reading a whole menu photo is one call, but still a Gemini round trip. */
const AI_REQUEST_TIMEOUT_MS = 45_000;

/**
 * Marks a message as safe and useful to show the restaurant owner. Anything
 * thrown that is not one of these is replaced with a generic message, so an
 * internal failure's own wording never reaches the page.
 */
class UserFacingError extends Error {}

const PROFILE_REQUIRED =
  'Complete your restaurant profile before analyzing a menu, so we know how to give feedback.';

/**
 * Reads the menu in `file` and stores the resulting feedback.
 *
 * The restaurant is read from the session's own profile, never accepted as
 * an argument - the same rule `generateContent` and `generateCampaign`
 * follow, and for the same reason: an id taken from the caller could be
 * used to analyze a menu against a restaurant that is not the caller's own.
 */
export async function analyzeMenu(file: File): Promise<AnalyzeMenuResult> {
  const profile = await getProfileForCurrentUser();
  if (profile === null) {
    return { status: 'rejected', message: PROFILE_REQUIRED };
  }

  let generated: NewMenuAnalysis;
  try {
    generated = await requestMenuAnalysis(file, profile);
  } catch (error) {
    return { status: 'rejected', message: describeFailure(error) };
  }

  const analysis = await saveMenuAnalysis(profile.id, generated, menuAnalysisRepository);

  revalidatePath('/menu-analysis');
  return { status: 'analyzed', analysis };
}

/** The signed-in account's own past analyses, newest first. */
export async function getAnalysesForCurrentUser(): Promise<MenuAnalysis[] | null> {
  const profile = await getProfileForCurrentUser();
  if (profile === null) {
    return null;
  }

  return getMenuAnalyses(profile.id, menuAnalysisRepository);
}

type MenuAnalysisPayload = {
  overview: string;
  pricing_notes: string;
  description_quality: string;
  upselling_ideas: string[];
  cross_selling_ideas: string[];
  missing_items: string[];
  improvement_suggestions: string[];
};

async function requestMenuAnalysis(
  file: File,
  profile: RestaurantProfile,
): Promise<NewMenuAnalysis> {
  const baseUrl = process.env.AI_SERVICE_URL;
  if (!baseUrl) {
    throw new UserFacingError('AI_SERVICE_URL is not configured.');
  }

  const body = new FormData();
  body.append('image', file, file.name);
  // snake_case: these are the AI service's field names, not ours. No
  // tone_of_voice sent here: menu analysis is consultative feedback, not
  // brand-voiced marketing copy, so the restaurant's tone is deliberately
  // left out - see MenuAnalysisRequestContext on the AI service.
  body.append('cuisine_type', profile.cuisineType);
  body.append('country', profile.country);
  body.append('language', profile.language);
  body.append('target_audience', profile.targetAudience ?? '');

  const response = await fetch(`${baseUrl}/menu-analysis/analyze`, {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    // The AI service writes its "detail" messages for end users, so they are
    // passed through rather than replaced with something vaguer.
    throw new UserFacingError(await readErrorDetail(response));
  }

  const payload: unknown = await response.json();
  if (!isMenuAnalysisPayload(payload)) {
    throw new UserFacingError('The AI service returned an unexpected response.');
  }

  return {
    overview: payload.overview,
    pricingNotes: payload.pricing_notes,
    descriptionQuality: payload.description_quality,
    upsellingIdeas: payload.upselling_ideas,
    crossSellingIdeas: payload.cross_selling_ideas,
    missingItems: payload.missing_items,
    improvementSuggestions: payload.improvement_suggestions,
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
  console.error('[menu-analysis] analysis failed', reason);
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

function isMenuAnalysisPayload(value: unknown): value is MenuAnalysisPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.overview === 'string' &&
    typeof candidate.pricing_notes === 'string' &&
    typeof candidate.description_quality === 'string' &&
    isStringArray(candidate.upselling_ideas) &&
    isStringArray(candidate.cross_selling_ideas) &&
    isStringArray(candidate.missing_items) &&
    isStringArray(candidate.improvement_suggestions)
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
