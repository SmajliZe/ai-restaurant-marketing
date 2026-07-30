import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getProfile, saveProfile } from './service';
import type { RestaurantProfile, RestaurantRepository } from './types';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';

function validForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const fields: Record<string, string> = {
    name: 'Trattoria Uno',
    address: 'Ferhadija 1, Sarajevo',
    country: 'Bosnia and Herzegovina',
    language: 'Bosnian',
    cuisineType: 'Neapolitan pizza',
    toneOfVoice: 'friendly',
    ...overrides,
  };

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  return formData;
}

function fakeRepository(existing: RestaurantProfile | null = null): RestaurantRepository {
  return {
    findByOwnerId: vi.fn(async () => existing),
    upsertForOwner: vi.fn(
      async (ownerId, input) => ({ id: 'row-id', ownerId, ...input }) as RestaurantProfile,
    ),
  };
}

let repository: RestaurantRepository;

beforeEach(() => {
  repository = fakeRepository();
});

describe('saveProfile', () => {
  it('saves a profile with only the required fields', async () => {
    expect(await saveProfile(OWNER_ID, validForm(), repository)).toEqual({ status: 'saved' });

    const [ownerId, input] = vi.mocked(repository.upsertForOwner).mock.calls[0] ?? [];
    expect(ownerId).toBe(OWNER_ID);
    expect(input?.name).toBe('Trattoria Uno');
    // Everything optional is stored as NULL rather than an empty string.
    expect(input?.website).toBeNull();
    expect(input?.description).toBeNull();
    expect(input?.openingHours).toBeNull();
    expect(input?.brandColors).toBeNull();
  });

  it('writes under the caller-supplied owner, whatever the form claims', async () => {
    const spoofed = validForm();
    spoofed.set('ownerId', 'someone-elses-account');
    spoofed.set('id', 'someone-elses-row');

    await saveProfile(OWNER_ID, spoofed, repository);

    const [ownerId, input] = vi.mocked(repository.upsertForOwner).mock.calls[0] ?? [];
    expect(ownerId).toBe(OWNER_ID);
    expect(input).not.toHaveProperty('ownerId');
    expect(input).not.toHaveProperty('id');
  });

  it.each([
    ['name', 'Restaurant name is required.'],
    ['address', 'Address is required.'],
    ['country', 'Country is required.'],
    ['language', 'Language is required.'],
    ['cuisineType', 'Cuisine type is required.'],
  ])('refuses a blank %s', async (field, message) => {
    const result = await saveProfile(OWNER_ID, validForm({ [field]: '  ' }), repository);

    expect(result).toEqual({ status: 'invalid', message });
    expect(repository.upsertForOwner).not.toHaveBeenCalled();
  });

  it('refuses a tone of voice that is not on the list', async () => {
    const result = await saveProfile(OWNER_ID, validForm({ toneOfVoice: 'sarcastic' }), repository);

    expect(result.status).toBe('invalid');
    expect(repository.upsertForOwner).not.toHaveBeenCalled();
  });

  it('parses opening hours into the weekly shape', async () => {
    const form = validForm();
    form.set('openingHours.monday.opens', '09:00');
    form.set('openingHours.monday.closes', '22:00');
    form.set('openingHours.sunday.closed', 'on');

    await saveProfile(OWNER_ID, form, repository);

    const [, input] = vi.mocked(repository.upsertForOwner).mock.calls[0] ?? [];
    expect(input?.openingHours).toEqual({
      monday: { closed: false, opens: '09:00', closes: '22:00' },
      sunday: { closed: true },
    });
  });

  it('refuses an opening time that is not a time', async () => {
    const form = validForm();
    form.set('openingHours.monday.opens', 'morning-ish');
    form.set('openingHours.monday.closes', '22:00');

    expect((await saveProfile(OWNER_ID, form, repository)).status).toBe('invalid');
  });

  it('splits brand colours on commas', async () => {
    await saveProfile(OWNER_ID, validForm({ brandColors: '#ff6b35, #0b0f14' }), repository);

    const [, input] = vi.mocked(repository.upsertForOwner).mock.calls[0] ?? [];
    expect(input?.brandColors).toEqual(['#ff6b35', '#0b0f14']);
  });

  it('refuses a brand colour that is not a hex code', async () => {
    const result = await saveProfile(OWNER_ID, validForm({ brandColors: 'orange' }), repository);

    expect(result.status).toBe('invalid');
  });

  it.each([
    ['website', 'not a url'],
    ['logoUrl', 'also not a url'],
    ['email', 'not-an-email'],
  ])('refuses a malformed %s', async (field, value) => {
    const result = await saveProfile(OWNER_ID, validForm({ [field]: value }), repository);

    expect(result.status).toBe('invalid');
    expect(repository.upsertForOwner).not.toHaveBeenCalled();
  });
});

describe('getProfile', () => {
  it('asks storage for the given owner only', async () => {
    const existing = { id: 'row', ownerId: OWNER_ID, name: 'Trattoria Uno' } as RestaurantProfile;

    expect(await getProfile(OWNER_ID, fakeRepositoryReturning(existing))).toBe(existing);
  });

  it('returns null when the owner has no profile yet', async () => {
    expect(await getProfile(OWNER_ID, repository)).toBeNull();
  });
});

function fakeRepositoryReturning(profile: RestaurantProfile): RestaurantRepository {
  return fakeRepository(profile);
}
