import { beforeEach, describe, expect, it, vi } from 'vitest';

import { verifyPassword } from './password';
import { registerUser } from './service';
import type { UserRepository } from './types';

const VALID = { email: 'Owner@Example.COM', password: 'a-long-enough-password' };

function fakeRepository(existing: { email: string } | null = null): UserRepository {
  return {
    findByEmail: vi.fn(async (email: string) =>
      existing !== null && existing.email === email
        ? { id: 'existing-id', email, passwordHash: 'irrelevant' }
        : null,
    ),
    insert: vi.fn(async ({ email }) => ({ id: 'new-id', email })),
  };
}

let repository: UserRepository;

beforeEach(() => {
  repository = fakeRepository();
});

describe('registerUser', () => {
  it('creates the account', async () => {
    expect(await registerUser(VALID, repository)).toEqual({ status: 'created' });
    expect(repository.insert).toHaveBeenCalledTimes(1);
  });

  it('stores a hash, never the password', async () => {
    await registerUser(VALID, repository);

    const [stored] = vi.mocked(repository.insert).mock.calls[0] ?? [];
    expect(stored?.passwordHash).toBeDefined();
    expect(stored?.passwordHash).not.toContain(VALID.password);
    expect(await verifyPassword(VALID.password, stored?.passwordHash ?? '')).toBe(true);
  });

  it('lowercases the email so one address cannot be registered twice', async () => {
    await registerUser(VALID, repository);

    expect(repository.findByEmail).toHaveBeenCalledWith('owner@example.com');
    expect(vi.mocked(repository.insert).mock.calls[0]?.[0].email).toBe('owner@example.com');
  });

  it('refuses an email that is already registered', async () => {
    const taken = fakeRepository({ email: 'owner@example.com' });

    const result = await registerUser(VALID, taken);

    expect(result).toEqual({
      status: 'email-taken',
      message: 'An account with that email already exists. Try signing in instead.',
    });
    expect(taken.insert).not.toHaveBeenCalled();
  });

  it('refuses a duplicate that only the unique index catches', async () => {
    // Two registrations for one address can both pass the availability check;
    // the insert is where one of them loses.
    const racing: UserRepository = {
      findByEmail: async () => null,
      insert: async () => {
        throw Object.assign(new Error('duplicate key'), { code: '23505' });
      },
    };

    const result = await registerUser(VALID, racing, (error) => {
      return (
        typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
      );
    });

    expect(result.status).toBe('email-taken');
  });

  it('lets an unrelated database failure surface', async () => {
    const broken: UserRepository = {
      findByEmail: async () => null,
      insert: async () => {
        throw new Error('connection reset');
      },
    };

    await expect(registerUser(VALID, broken, () => false)).rejects.toThrow('connection reset');
  });

  it.each([
    ['a missing email', { email: '', password: VALID.password }],
    ['a malformed email', { email: 'not-an-email', password: VALID.password }],
    ['a short password', { email: VALID.email, password: 'short' }],
    ['a non-string email', { email: 42, password: VALID.password }],
    ['a non-string password', { email: VALID.email, password: null }],
  ])('refuses %s without touching storage', async (_label, input) => {
    const result = await registerUser(input, repository);

    expect(result.status).toBe('invalid');
    expect(repository.findByEmail).not.toHaveBeenCalled();
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('refuses a password longer than bcrypt can read', async () => {
    const result = await registerUser({ email: VALID.email, password: 'x'.repeat(73) }, repository);

    expect(result.status).toBe('invalid');
  });
});
