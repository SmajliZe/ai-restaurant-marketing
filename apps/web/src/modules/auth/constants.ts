/**
 * Password rules, kept apart from `password.ts` so the browser can show them
 * without importing bcrypt, which is a native module and cannot be bundled.
 */

export const MIN_PASSWORD_LENGTH = 12;

/** bcrypt truncates at 72 bytes, so anything longer would silently not count. */
export const MAX_PASSWORD_BYTES = 72;
