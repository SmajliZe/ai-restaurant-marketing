'use server';

import { getCalendarForCurrentWeek } from '@/modules/content-calendar/actions';
import { getCampaignsForCurrentUser } from '@/modules/content-campaign/actions';
import { getHistoryForCurrentUser } from '@/modules/content-history/actions';
import { marketingAssistantRepository } from '@/modules/marketing-assistant/repository';
import {
  appendMessage,
  getMessages,
  getOrCreateConversation,
} from '@/modules/marketing-assistant/service';
import type { ConversationMessage, SendMessageResult } from '@/modules/marketing-assistant/types';
import { getAnalysesForCurrentUser } from '@/modules/menu-analysis/actions';
import { getProfileForCurrentUser } from '@/modules/restaurant-profile/actions';
import type { RestaurantProfile } from '@/modules/restaurant-profile/types';

/** A few thousand characters is plenty for a chat message; this stops an
 * accidental paste of something enormous from becoming an expensive call. */
const MAX_MESSAGE_LENGTH = 4000;

/** Generous: a chat reply is one call, but still a Gemini round trip. */
const AI_REQUEST_TIMEOUT_MS = 45_000;

/**
 * Marks a message as safe and useful to show the restaurant owner. Anything
 * thrown that is not one of these is replaced with a generic message, so an
 * internal failure's own wording never reaches the page.
 */
class UserFacingError extends Error {}

const PROFILE_REQUIRED =
  'Complete your restaurant profile before chatting with the assistant, so it knows your restaurant.';

/**
 * The signed-in account's own conversation and its messages, creating the
 * conversation if this is the first visit - the same reason
 * `getCalendarForCurrentWeek` and `getCampaignsForCurrentUser` resolve
 * ownership from the session rather than taking a restaurant id argument.
 */
export async function getConversationForCurrentUser(): Promise<{
  messages: ConversationMessage[];
} | null> {
  const profile = await getProfileForCurrentUser();
  if (profile === null) {
    return null;
  }

  const conversation = await getOrCreateConversation(profile.id, marketingAssistantRepository);
  const messages = await getMessages(conversation.id, marketingAssistantRepository);
  return { messages };
}

/**
 * Sends `content` as the owner's next message and returns the full,
 * up-to-date message list once the assistant has replied.
 *
 * The restaurant is read from the session's own profile, never accepted as
 * an argument - the same rule `generateContent` and `generateCampaign`
 * follow. The user's own message is persisted before the AI call is made,
 * so it is never lost even if the reply fails - only the reply is missing,
 * the same way a real chat client still shows what you sent when the
 * response fails to arrive.
 */
export async function sendMessage(content: string): Promise<SendMessageResult> {
  const trimmed = content.trim();
  if (trimmed === '') {
    return { status: 'rejected', message: 'Type a message before sending.' };
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return {
      status: 'rejected',
      message: `Messages are limited to ${MAX_MESSAGE_LENGTH} characters.`,
    };
  }

  const profile = await getProfileForCurrentUser();
  if (profile === null) {
    return { status: 'rejected', message: PROFILE_REQUIRED };
  }

  const conversation = await getOrCreateConversation(profile.id, marketingAssistantRepository);
  await appendMessage(conversation.id, 'user', trimmed, marketingAssistantRepository);

  const history = await getMessages(conversation.id, marketingAssistantRepository);
  const activitySummary = await buildActivitySummary();

  let reply: string;
  try {
    reply = await requestAssistantReply(history, profile, activitySummary);
  } catch (error) {
    return { status: 'rejected', message: describeFailure(error) };
  }

  await appendMessage(conversation.id, 'assistant', reply, marketingAssistantRepository);
  const messages = await getMessages(conversation.id, marketingAssistantRepository);
  return { status: 'sent', messages };
}

/**
 * A short plain-text snapshot of the current restaurant's recent activity,
 * or null when there is nothing to report yet.
 *
 * Built entirely from the other modules' own session-scoped read actions -
 * `getHistoryForCurrentUser`, `getCalendarForCurrentWeek`,
 * `getCampaignsForCurrentUser`, `getAnalysesForCurrentUser` - rather than
 * querying their repositories directly: each of those already resolves the
 * caller's own restaurant from the session and stays the one place that
 * ownership check lives, the same reason this function takes no restaurant
 * id of its own to pass down.
 */
async function buildActivitySummary(): Promise<string | null> {
  const [history, calendar, campaigns, analyses] = await Promise.all([
    getHistoryForCurrentUser(5, 0),
    getCalendarForCurrentWeek(),
    getCampaignsForCurrentUser(),
    getAnalysesForCurrentUser(),
  ]);

  const lines: string[] = [];

  if (history !== null && history.entries.length > 0) {
    const recent = history.entries
      .map((entry) => `${entry.recognizedDish} (${formatDate(entry.createdAt)})`)
      .join(', ');
    lines.push(`Recently generated content for: ${recent}.`);
  }

  if (calendar !== null && calendar.entries.length > 0) {
    const themes = calendar.entries.map((entry) => entry.theme).join(', ');
    lines.push(`This week's planned content themes: ${themes}.`);
  }

  const activeCampaigns = (campaigns ?? []).filter((campaign) => campaign.status === 'active');
  if (activeCampaigns.length > 0) {
    const names = activeCampaigns.map((campaign) => campaign.name).join(', ');
    lines.push(`Active campaigns: ${names}.`);
  }

  if (analyses !== null && analyses.length > 0) {
    lines.push(`Most recent menu analysis: ${analyses[0]!.overview}`);
  }

  return lines.length > 0 ? lines.join(' ') : null;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date);
}

type AssistantChatPayload = { reply: string };

async function requestAssistantReply(
  history: ConversationMessage[],
  profile: RestaurantProfile,
  activitySummary: string | null,
): Promise<string> {
  const baseUrl = process.env.AI_SERVICE_URL;
  if (!baseUrl) {
    throw new UserFacingError('AI_SERVICE_URL is not configured.');
  }

  const response = await fetch(`${baseUrl}/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // snake_case: these are the AI service's field names, not ours.
    body: JSON.stringify({
      messages: history.map((message) => ({ role: message.role, content: message.content })),
      context: {
        tone_of_voice: profile.toneOfVoice,
        cuisine_type: profile.cuisineType,
        country: profile.country,
        language: profile.language,
        target_audience: profile.targetAudience,
        activity_summary: activitySummary,
      },
    }),
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    // The AI service writes its "detail" messages for end users, so they are
    // passed through rather than replaced with something vaguer.
    throw new UserFacingError(await readErrorDetail(response));
  }

  const payload: unknown = await response.json();
  if (!isAssistantChatPayload(payload)) {
    throw new UserFacingError('The AI service returned an unexpected response.');
  }

  return payload.reply;
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
  console.error('[marketing-assistant] chat failed', reason);
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

function isAssistantChatPayload(value: unknown): value is AssistantChatPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.reply === 'string';
}
