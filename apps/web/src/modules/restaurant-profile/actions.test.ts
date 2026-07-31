import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RestaurantProfile } from './types';

const { authMock, repositoryMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  repositoryMock: {
    findByOwnerId: vi.fn(),
    upsertForOwner: vi.fn(),
  },
}));

vi.mock('~/auth', () => ({ auth: authMock }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/modules/restaurant-profile/repository', () => ({
  restaurantRepository: repositoryMock,
}));

const { getProfileForCurrentUser, upsertProfileAction } = await import('./actions');

const SESSION_OWNER = '11111111-1111-4111-8111-111111111111';
const IDLE = { status: 'idle' } as const;

function validForm(): FormData {
  const formData = new FormData();
  formData.set('name', 'Trattoria Uno');
  formData.set('address', 'Ferhadija 1, Sarajevo');
  formData.set('country', 'Bosnia and Herzegovina');
  formData.set('language', 'Bosnian');
  formData.set('cuisineType', 'Neapolitan pizza');
  formData.set('toneOfVoice', 'friendly');
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  repositoryMock.upsertForOwner.mockResolvedValue({} as RestaurantProfile);
  repositoryMock.findByOwnerId.mockResolvedValue(null);
});

describe('upsertProfileAction', () => {
  it('saves under the account in the session', async () => {
    authMock.mockResolvedValue({ user: { id: SESSION_OWNER } });

    expect(await upsertProfileAction(IDLE, validForm())).toEqual({ status: 'saved' });
    expect(repositoryMock.upsertForOwner).toHaveBeenCalledWith(SESSION_OWNER, expect.anything());
  });

  it('ignores an owner id smuggled in through the form', async () => {
    authMock.mockResolvedValue({ user: { id: SESSION_OWNER } });
    const spoofed = validForm();
    spoofed.set('ownerId', '22222222-2222-4222-8222-222222222222');

    await upsertProfileAction(IDLE, spoofed);

    const [ownerId] = repositoryMock.upsertForOwner.mock.calls[0] ?? [];
    expect(ownerId).toBe(SESSION_OWNER);
  });

  it.each([
    ['there is no session', null],
    ['the session carries no user', { user: undefined }],
    ['the session user has no id', { user: { email: 'owner@example.com' } }],
  ])('refuses to write when %s', async (_label, session) => {
    authMock.mockResolvedValue(session);

    const result = await upsertProfileAction(IDLE, validForm());

    expect(result).toEqual({
      status: 'error',
      message: 'Your session has expired. Sign in again to save your profile.',
    });
    expect(repositoryMock.upsertForOwner).not.toHaveBeenCalled();
  });

  it('reports a validation failure without writing', async () => {
    authMock.mockResolvedValue({ user: { id: SESSION_OWNER } });
    const incomplete = validForm();
    incomplete.set('name', '');

    const result = await upsertProfileAction(IDLE, incomplete);

    expect(result.status).toBe('error');
    expect(repositoryMock.upsertForOwner).not.toHaveBeenCalled();
  });
});

describe('getProfileForCurrentUser', () => {
  it('reads only the session account', async () => {
    authMock.mockResolvedValue({ user: { id: SESSION_OWNER } });

    await getProfileForCurrentUser();

    expect(repositoryMock.findByOwnerId).toHaveBeenCalledWith(SESSION_OWNER);
  });

  it('returns null without a session, rather than somebody else data', async () => {
    authMock.mockResolvedValue(null);

    expect(await getProfileForCurrentUser()).toBeNull();
    expect(repositoryMock.findByOwnerId).not.toHaveBeenCalled();
  });
});
