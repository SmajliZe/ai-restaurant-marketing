'use server';

import { revalidatePath } from 'next/cache';

import { getProfileForCurrentUser } from '@/modules/restaurant-profile/actions';
import type { RestaurantProfile } from '@/modules/restaurant-profile/types';
import { styleAnalysisRepository } from '@/modules/style-analysis/repository';
import { getStyleAnalyses, saveStyleAnalysis } from '@/modules/style-analysis/service';
import type {
  AnalyzeStyleResult,
  NewStyleAnalysis,
  ProfileImageGroup,
  StyleAnalysis,
} from '@/modules/style-analysis/types';

/** Generous: reading several reference profiles is one call, but still a Gemini round trip. */
const AI_REQUEST_TIMEOUT_MS = 45_000;

/** Mirrors the AI service's own field naming - see app/api/style_analysis.py. */
const MAX_PROFILES = 3;
const MAX_POSTS_PER_PROFILE = 3;

/**
 * Marks a message as safe and useful to show the restaurant owner. Anything
 * thrown that is not one of these is replaced with a generic message, so an
 * internal failure's own wording never reaches the page.
 */
class UserFacingError extends Error {}

const PROFILE_REQUIRED =
  'Complete your restaurant profile before analyzing reference profiles, so we know how to write for you.';

/**
 * Reads the reference profile screenshots in `profileGroups` and stores the
 * resulting style plan.
 *
 * The restaurant is read from the session's own profile, never accepted as
 * an argument - the same rule `generateContent` and `analyzeMenu` follow,
 * and for the same reason: an id taken from the caller could be used to
 * write a plan for a restaurant that is not the caller's own.
 */
export async function analyzeStyle(profileGroups: ProfileImageGroup[]): Promise<AnalyzeStyleResult> {
  const nonEmptyGroups = profileGroups.filter(
    (group) => group.feed !== null || group.posts.length > 0,
  );
  if (nonEmptyGroups.length === 0) {
    return { status: 'rejected', message: 'Upload at least one reference image to analyze.' };
  }

  const profile = await getProfileForCurrentUser();
  if (profile === null) {
    return { status: 'rejected', message: PROFILE_REQUIRED };
  }

  let generated: Omit<NewStyleAnalysis, 'profileCount'>;
  try {
    generated = await requestStyleAnalysis(nonEmptyGroups, profile);
  } catch (error) {
    return { status: 'rejected', message: describeFailure(error) };
  }

  const analysis = await saveStyleAnalysis(
    profile.id,
    { ...generated, profileCount: nonEmptyGroups.length },
    styleAnalysisRepository,
  );

  revalidatePath('/style-analysis');
  return { status: 'analyzed', analysis };
}

/** The signed-in account's own past style analyses, newest first. */
export async function getStyleAnalysesForCurrentUser(): Promise<StyleAnalysis[] | null> {
  const profile = await getProfileForCurrentUser();
  if (profile === null) {
    return null;
  }

  return getStyleAnalyses(profile.id, styleAnalysisRepository);
}

type StyleAnalysisPayload = {
  visual_style_notes: string;
  content_style_notes: string;
  content_pillars: string[];
  recommendations: string[];
};

async function requestStyleAnalysis(
  profileGroups: ProfileImageGroup[],
  profile: RestaurantProfile,
): Promise<Omit<NewStyleAnalysis, 'profileCount'>> {
  const baseUrl = process.env.AI_SERVICE_URL;
  if (!baseUrl) {
    throw new UserFacingError('AI_SERVICE_URL is not configured.');
  }

  const body = new FormData();
  profileGroups.slice(0, MAX_PROFILES).forEach((group, groupIndex) => {
    const profileNumber = groupIndex + 1;
    if (group.feed !== null) {
      body.append(`profile_${profileNumber}_feed`, group.feed, group.feed.name);
    }
    group.posts.slice(0, MAX_POSTS_PER_PROFILE).forEach((post, postIndex) => {
      body.append(`profile_${profileNumber}_post_${postIndex + 1}`, post, post.name);
    });
  });
  // snake_case: these are the AI service's field names, not ours.
  body.append('cuisine_type', profile.cuisineType);
  body.append('tone_of_voice', profile.toneOfVoice);
  body.append('country', profile.country);
  body.append('language', profile.language);
  body.append('target_audience', profile.targetAudience ?? '');

  const response = await fetch(`${baseUrl}/style-analysis/analyze`, {
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
  if (!isStyleAnalysisPayload(payload)) {
    throw new UserFacingError('The AI service returned an unexpected response.');
  }

  return {
    visualStyleNotes: payload.visual_style_notes,
    contentStyleNotes: payload.content_style_notes,
    contentPillars: payload.content_pillars,
    recommendations: payload.recommendations,
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
  console.error('[style-analysis] analysis failed', reason);
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

function isStyleAnalysisPayload(value: unknown): value is StyleAnalysisPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.visual_style_notes === 'string' &&
    typeof candidate.content_style_notes === 'string' &&
    isStringArray(candidate.content_pillars) &&
    isStringArray(candidate.recommendations)
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
