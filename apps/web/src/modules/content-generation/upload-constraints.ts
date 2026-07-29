/**
 * Limits shared by the browser and the Server Action.
 *
 * The browser checks them so a rejected file costs nothing to find out about;
 * the Server Action checks them again because anything arriving over the wire
 * is untrusted. Keeping both on one definition stops the two from drifting.
 *
 * These mirror what the AI service enforces. If they ever disagree, the stricter
 * one wins and the user sees a worse message, so change them together.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Value for an <input type="file"> accept attribute. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_MIME_TYPES.join(',');

/** Returns a message describing why the file is unusable, or null if it is fine. */
export function describeUploadProblem(file: File): string | null {
  if (file.size === 0) {
    return 'That file is empty. Choose a photo and try again.';
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return `That photo is ${formatMegabytes(file.size)}. The limit is ${formatMegabytes(MAX_UPLOAD_BYTES)}.`;
  }

  // Browsers append parameters such as "; charset=..." to the type.
  const declaredType = file.type.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(declaredType)) {
    return 'Only JPEG, PNG and WebP photos are supported.';
  }

  return null;
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
