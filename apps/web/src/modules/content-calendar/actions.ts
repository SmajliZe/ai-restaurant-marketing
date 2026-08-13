'use server';

import { revalidatePath } from 'next/cache';

import { contentCalendarRepository } from '@/modules/content-calendar/repository';
import {
  currentWeekStartDate,
  getWeek,
  replaceWeek,
  toggleCompleted,
} from '@/modules/content-calendar/service';
import type {
  CalendarWeek,
  GenerateWeeklyCalendarResult,
  NewCalendarDayEntry,
} from '@/modules/content-calendar/types';
import { getProfileForCurrentUser } from '@/modules/restaurant-profile/actions';
import type { RestaurantProfile } from '@/modules/restaurant-profile/types';

/** Generous: planning a week is one call, but still a Gemini round trip. */
const AI_REQUEST_TIMEOUT_MS = 45_000;

/**
 * Marks a message as safe and useful to show the restaurant owner. Anything
 * thrown that is not one of these is replaced with a generic message, so an
 * internal failure's own wording never reaches the page.
 */
class UserFacingError extends Error {}

const PROFILE_REQUIRED =
  'Complete your restaurant profile before generating a content calendar, so we know how to plan.';

/**
 * Plans the current week and replaces whatever was there before.
 *
 * The restaurant is read from the session's own profile, never accepted as
 * an argument - the same rule `generateContent` follows, and for the same
 * reason: an id taken from the caller could be used to plan a week for a
 * restaurant that is not the caller's own.
 *
 * Regenerating discards the previous week's rows entirely, including
 * whatever `is_completed` state they carried - the caller is responsible for
 * warning about that before calling this, since by the time this runs there
 * is nothing left to warn about.
 */
export async function generateWeeklyCalendar(): Promise<GenerateWeeklyCalendarResult> {
  const profile = await getProfileForCurrentUser();
  if (profile === null) {
    return { status: 'rejected', message: PROFILE_REQUIRED };
  }

  let entries: NewCalendarDayEntry[];
  try {
    entries = await requestCalendar(profile);
  } catch (error) {
    return { status: 'rejected', message: describeFailure(error) };
  }

  const weekStartDate = currentWeekStartDate();
  const week = await replaceWeek(profile.id, weekStartDate, entries, contentCalendarRepository);

  revalidatePath('/calendar');
  revalidatePath('/dashboard');
  return { status: 'generated', week };
}

/** The signed-in account's plan for the current week, or null if there is none yet. */
export async function getCalendarForCurrentWeek(): Promise<CalendarWeek | null> {
  const profile = await getProfileForCurrentUser();
  if (profile === null) {
    return null;
  }

  return getWeek(profile.id, currentWeekStartDate(), contentCalendarRepository);
}

/**
 * Flips one day's completed flag.
 *
 * `entryId` arrives from the browser, so it is untrusted: ownership is
 * checked inside `toggleCompleted` against the session's own restaurant, not
 * assumed from the id alone. An id for someone else's entry, or one that
 * does not exist, both quietly do nothing.
 */
export async function toggleEntryCompleted(entryId: string): Promise<void> {
  const profile = await getProfileForCurrentUser();
  if (profile === null) {
    return;
  }

  await toggleCompleted(entryId, profile.id, contentCalendarRepository);
  revalidatePath('/calendar');
}

type CalendarEntryPayload = { day_of_week: number; theme: string; content_angle: string };
type CalendarPayload = { entries: CalendarEntryPayload[] };

async function requestCalendar(profile: RestaurantProfile): Promise<NewCalendarDayEntry[]> {
  const baseUrl = process.env.AI_SERVICE_URL;
  if (!baseUrl) {
    throw new UserFacingError('AI_SERVICE_URL is not configured.');
  }

  const response = await fetch(`${baseUrl}/calendar/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // snake_case: these are the AI service's field names, not ours.
    body: JSON.stringify({
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
  if (!isCalendarPayload(payload)) {
    throw new UserFacingError('The AI service returned an unexpected response.');
  }

  return payload.entries.map((entry) => ({
    dayOfWeek: entry.day_of_week,
    theme: entry.theme,
    contentAngle: entry.content_angle,
  }));
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
  console.error('[content-calendar] generation failed', reason);
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

function isCalendarPayload(value: unknown): value is CalendarPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.entries) && candidate.entries.every(isCalendarEntryPayload);
}

function isCalendarEntryPayload(value: unknown): value is CalendarEntryPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.day_of_week === 'number' &&
    typeof candidate.theme === 'string' &&
    typeof candidate.content_angle === 'string'
  );
}
