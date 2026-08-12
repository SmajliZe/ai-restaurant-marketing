'use server';

import { storeEnhancedImage } from '@/modules/content-generation/enhanced-image-store';
import { enhanceImage } from '@/modules/content-generation/image-enhancement';
import type {
  ContentOutcome,
  EnhancementOutcome,
  GenerateContentResult,
  RestaurantContext,
  StickerType,
} from '@/modules/content-generation/types';
import { describeUploadProblem } from '@/modules/content-generation/upload-constraints';
import { saveGeneratedContent } from '@/modules/content-history/actions';
import { getProfileForCurrentUser } from '@/modules/restaurant-profile/actions';

/**
 * Generous: a vision model working on a 10 MB photo is not fast, and content
 * that arrives late still beats content that never arrives.
 */
const AI_REQUEST_TIMEOUT_MS = 45_000;

/**
 * Marks a message as safe and useful to show to the person who uploaded the
 * photo. Anything thrown that is not one of these is treated as an internal
 * failure and replaced, so library text like sharp's "Input buffer contains
 * unsupported image format" never reaches the page.
 */
class UserFacingError extends Error {}

const PROFILE_REQUIRED =
  'Complete your restaurant profile before generating content, so we know how to write.';

/**
 * Generate Instagram, Facebook, and Story content and an enhanced copy of an
 * uploaded photo.
 *
 * The restaurant details are read here from the session's own profile rather
 * than taken as an argument. A Server Action's arguments arrive from the
 * browser, so a caller that could pass its own tone and cuisine could ask us
 * to write as any restaurant it liked - the same reason the profile's owner
 * comes from the session and not from the form.
 */
export async function generateContent(formData: FormData): Promise<GenerateContentResult> {
  const file = formData.get('image');

  if (!(file instanceof File)) {
    return { status: 'rejected', message: 'Choose a photo to upload.' };
  }

  const problem = describeUploadProblem(file);
  if (problem !== null) {
    return { status: 'rejected', message: problem };
  }

  // The page refuses to render the form without a profile; this is the same
  // rule enforced where it cannot be skipped.
  const profile = await getProfileForCurrentUser();
  if (profile === null) {
    return { status: 'rejected', message: PROFILE_REQUIRED };
  }

  const restaurantContext: RestaurantContext = {
    toneOfVoice: profile.toneOfVoice,
    cuisineType: profile.cuisineType,
    country: profile.country,
    language: profile.language,
    targetAudience: profile.targetAudience,
  };

  const buffer = Buffer.from(await file.arrayBuffer());

  // allSettled rather than all: the two halves are independent, and content
  // is still worth showing when the enhancement fails, or the other way round.
  const [content, enhancement] = await Promise.allSettled([
    requestContent(file, restaurantContext),
    enhanceAndStore(buffer),
  ]);

  const contentOutcome = toContentOutcome(content);
  const enhancementOutcome = toEnhancementOutcome(enhancement);

  await recordHistoryIfComplete(profile.id, contentOutcome, enhancementOutcome);

  return {
    status: 'completed',
    content: contentOutcome,
    enhancement: enhancementOutcome,
  };
}

/**
 * Persists a history row for a fully successful run only.
 *
 * "Fully" because a history row needs a real enhanced image to point at -
 * the column is not nullable - so a partial result (content without an
 * enhancement, or the other way round) is not a "successful AI call" for
 * this purpose, the same way it is not one for the response the user sees.
 *
 * A failure here is logged and swallowed rather than propagated: history is
 * a record of what happened, not part of the user-facing result, so losing
 * it to a transient database issue must not cost the user the content they
 * just watched generate.
 */
async function recordHistoryIfComplete(
  restaurantId: string,
  content: ContentOutcome,
  enhancement: EnhancementOutcome,
): Promise<void> {
  if (!content.ok || !enhancement.ok) {
    return;
  }

  try {
    await saveGeneratedContent(restaurantId, {
      recognizedDish: content.recognizedDish,
      confidence: content.confidence,
      instagram: content.instagram,
      facebook: content.facebook,
      story: content.story,
      enhancedImagePath: enhancement.enhancedImageUrl,
    });
  } catch (error) {
    console.error('[content-generation] failed to save history', error);
  }
}

type ContentPayload = {
  recognized_dish: string;
  confidence: number;
  instagram: { caption: string; hashtags: string[] };
  facebook: { post: string; hashtags: string[] };
  story: { text: string; cta: string; sticker_type: StickerType; sticker_prompt: string };
};

async function requestContent(
  file: File,
  restaurantContext: RestaurantContext,
): Promise<ContentPayload> {
  const baseUrl = process.env.AI_SERVICE_URL;
  if (!baseUrl) {
    throw new UserFacingError('AI_SERVICE_URL is not configured.');
  }

  const body = new FormData();
  body.append('image', file, file.name);
  // snake_case: these are the AI service's field names, not ours.
  body.append('tone_of_voice', restaurantContext.toneOfVoice);
  body.append('cuisine_type', restaurantContext.cuisineType);
  body.append('country', restaurantContext.country);
  body.append('language', restaurantContext.language);
  body.append('target_audience', restaurantContext.targetAudience ?? '');

  const response = await fetch(`${baseUrl}/content/generate`, {
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
  if (!isContentPayload(payload)) {
    throw new UserFacingError('The AI service returned an unexpected response.');
  }

  return payload;
}

async function enhanceAndStore(buffer: Buffer): Promise<string> {
  return storeEnhancedImage(await enhanceImage(buffer));
}

function toContentOutcome(result: PromiseSettledResult<ContentPayload>): ContentOutcome {
  if (result.status === 'fulfilled') {
    const payload = result.value;
    return {
      ok: true,
      recognizedDish: payload.recognized_dish,
      confidence: payload.confidence,
      instagram: {
        caption: payload.instagram.caption,
        hashtags: payload.instagram.hashtags,
      },
      facebook: {
        post: payload.facebook.post,
        hashtags: payload.facebook.hashtags,
      },
      story: {
        text: payload.story.text,
        cta: payload.story.cta,
        stickerType: payload.story.sticker_type,
        stickerPrompt: payload.story.sticker_prompt,
      },
    };
  }

  if (result.reason instanceof Error && result.reason.name === 'TimeoutError') {
    return {
      ok: false,
      message: 'The AI service took too long to respond. Try again in a moment.',
    };
  }

  return {
    ok: false,
    message: describeFailure('content', result.reason, 'Could not reach the AI service.'),
  };
}

function toEnhancementOutcome(result: PromiseSettledResult<string>): EnhancementOutcome {
  if (result.status === 'fulfilled') {
    return { ok: true, enhancedImageUrl: result.value };
  }

  // Nothing sharp throws is written for a person to read, so the enhancement
  // side never has a message worth passing through.
  return {
    ok: false,
    message: describeFailure(
      'enhancement',
      result.reason,
      'Could not process that photo. It may be corrupted or in an unusual format.',
    ),
  };
}

function describeFailure(stage: string, reason: unknown, fallback: string): string {
  if (reason instanceof UserFacingError) {
    return reason.message;
  }

  // Unexpected, so it is worth a server-side record; the visitor gets the
  // generic message instead of a library's internals.
  console.error(`[content-generation] ${stage} failed`, reason);
  return fallback;
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

function isContentPayload(value: unknown): value is ContentPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.recognized_dish === 'string' &&
    typeof candidate.confidence === 'number' &&
    isInstagramPayload(candidate.instagram) &&
    isFacebookPayload(candidate.facebook) &&
    isStoryPayload(candidate.story)
  );
}

function isInstagramPayload(value: unknown): value is ContentPayload['instagram'] {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.caption === 'string' && isStringArray(candidate.hashtags);
}

function isFacebookPayload(value: unknown): value is ContentPayload['facebook'] {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.post === 'string' && isStringArray(candidate.hashtags);
}

function isStoryPayload(value: unknown): value is ContentPayload['story'] {
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
