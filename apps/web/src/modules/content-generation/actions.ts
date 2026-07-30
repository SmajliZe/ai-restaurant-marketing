'use server';

import { storeEnhancedImage } from '@/modules/content-generation/enhanced-image-store';
import { enhanceImage } from '@/modules/content-generation/image-enhancement';
import type {
  CaptionOutcome,
  EnhancementOutcome,
  GenerateContentResult,
} from '@/modules/content-generation/types';
import { describeUploadProblem } from '@/modules/content-generation/upload-constraints';

/**
 * Generous: a vision model working on a 10 MB photo is not fast, and a caption
 * that arrives late still beats one that never arrives.
 */
const AI_REQUEST_TIMEOUT_MS = 45_000;

/**
 * Marks a message as safe and useful to show to the person who uploaded the
 * photo. Anything thrown that is not one of these is treated as an internal
 * failure and replaced, so library text like sharp's "Input buffer contains
 * unsupported image format" never reaches the page.
 */
class UserFacingError extends Error {}

export async function generateContent(formData: FormData): Promise<GenerateContentResult> {
  const file = formData.get('image');

  if (!(file instanceof File)) {
    return { status: 'rejected', message: 'Choose a photo to upload.' };
  }

  const problem = describeUploadProblem(file);
  if (problem !== null) {
    return { status: 'rejected', message: problem };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // allSettled rather than all: the two halves are independent, and a caption
  // is still worth showing when the enhancement fails, or the other way round.
  const [caption, enhancement] = await Promise.allSettled([
    requestCaption(file),
    enhanceAndStore(buffer),
  ]);

  return {
    status: 'completed',
    caption: toCaptionOutcome(caption),
    enhancement: toEnhancementOutcome(enhancement),
  };
}

type CaptionPayload = {
  recognized_dish: string;
  caption: string;
  hashtags: string[];
};

async function requestCaption(file: File): Promise<CaptionPayload> {
  const baseUrl = process.env.AI_SERVICE_URL;
  if (!baseUrl) {
    throw new UserFacingError('AI_SERVICE_URL is not configured.');
  }

  const body = new FormData();
  body.append('image', file, file.name);

  const response = await fetch(`${baseUrl}/content/generate-caption`, {
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
  if (!isCaptionPayload(payload)) {
    throw new UserFacingError('The AI service returned an unexpected response.');
  }

  return payload;
}

async function enhanceAndStore(buffer: Buffer): Promise<string> {
  return storeEnhancedImage(await enhanceImage(buffer));
}

function toCaptionOutcome(result: PromiseSettledResult<CaptionPayload>): CaptionOutcome {
  if (result.status === 'fulfilled') {
    return {
      ok: true,
      recognizedDish: result.value.recognized_dish,
      caption: result.value.caption,
      hashtags: result.value.hashtags,
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
    message: describeFailure('caption', result.reason, 'Could not reach the AI service.'),
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

function isCaptionPayload(value: unknown): value is CaptionPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.recognized_dish === 'string' &&
    typeof candidate.caption === 'string' &&
    Array.isArray(candidate.hashtags) &&
    candidate.hashtags.every((hashtag) => typeof hashtag === 'string')
  );
}
