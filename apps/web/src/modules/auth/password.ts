import bcrypt from 'bcrypt';

/**
 * Cost factor. Each increment doubles the work; 12 is the usual starting point
 * and takes roughly a quarter of a second on current hardware, which is slow
 * enough to matter to an attacker and fast enough not to matter to a login.
 */
const SALT_ROUNDS = 12;

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}
