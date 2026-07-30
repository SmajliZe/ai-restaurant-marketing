import { z } from 'zod';

import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from '@/modules/auth/constants';
import { hashPassword } from '@/modules/auth/password';
import type { RegisterResult, UserRepository } from '@/modules/auth/types';

const EMAIL_TAKEN_MESSAGE = 'An account with that email already exists. Try signing in instead.';

const registrationSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address.')
    .max(320, 'That email address is too long.')
    .pipe(z.email('Enter a valid email address.'))
    // Lowercased so the same address cannot be registered twice in different
    // cases; the unique index compares byte for byte.
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    .refine(
      (value) => Buffer.byteLength(value, 'utf8') <= MAX_PASSWORD_BYTES,
      `Use at most ${MAX_PASSWORD_BYTES} bytes; bcrypt ignores anything past that.`,
    ),
});

export type RegistrationInput = { email: unknown; password: unknown };

/**
 * Create an account.
 *
 * Deliberately does not sign the new user in: registration and authentication
 * stay separate, so a change to one cannot quietly grant a session in the other.
 */
export async function registerUser(
  input: RegistrationInput,
  repository: UserRepository,
  onDuplicate: (error: unknown) => boolean = () => false,
): Promise<RegisterResult> {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'invalid', message: firstMessage(parsed.error) };
  }

  const { email, password } = parsed.data;

  if (await repository.findByEmail(email)) {
    return { status: 'email-taken', message: EMAIL_TAKEN_MESSAGE };
  }

  // Hashing after the availability check so a duplicate registration does not
  // pay for a bcrypt round it will throw away.
  const passwordHash = await hashPassword(password);

  try {
    await repository.insert({ email, passwordHash });
  } catch (error) {
    // Lost the race against another registration for the same address.
    if (onDuplicate(error)) {
      return { status: 'email-taken', message: EMAIL_TAKEN_MESSAGE };
    }
    throw error;
  }

  return { status: 'created' };
}

function firstMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Check the details and try again.';
}
