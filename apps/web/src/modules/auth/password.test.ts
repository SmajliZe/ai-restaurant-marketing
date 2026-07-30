import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password';

const PASSWORD = 'correct horse battery staple';

describe('password hashing', () => {
  it('never keeps the password in the hash', async () => {
    const hash = await hashPassword(PASSWORD);

    expect(hash).not.toContain(PASSWORD);
    expect(hash).not.toContain('horse');
  });

  it('produces a bcrypt hash at cost 12', async () => {
    const hash = await hashPassword(PASSWORD);

    expect(hash).toMatch(/^\$2[aby]\$12\$/);
  });

  it('accepts the right password', async () => {
    expect(await verifyPassword(PASSWORD, await hashPassword(PASSWORD))).toBe(true);
  });

  it.each([
    ['a different password', 'incorrect horse battery staple'],
    ['a prefix of the password', 'correct horse'],
    ['an empty string', ''],
    ['a case variation', 'Correct Horse Battery Staple'],
  ])('rejects %s', async (_label, attempt) => {
    expect(await verifyPassword(attempt, await hashPassword(PASSWORD))).toBe(false);
  });

  it('salts, so the same password hashes differently every time', async () => {
    const [first, second] = await Promise.all([hashPassword(PASSWORD), hashPassword(PASSWORD)]);

    expect(first).not.toBe(second);
    // Both still verify: the salt travels inside the hash.
    expect(await verifyPassword(PASSWORD, first)).toBe(true);
    expect(await verifyPassword(PASSWORD, second)).toBe(true);
  });

  it('does not treat a corrupted hash as a match', async () => {
    expect(await verifyPassword(PASSWORD, 'not-a-bcrypt-hash')).toBe(false);
  });
});
