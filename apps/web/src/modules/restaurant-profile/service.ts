import { z } from 'zod';

import { TONE_OF_VOICE_VALUES, WEEKDAYS, type DayOpeningHours } from '@/db/schema';
import type {
  RestaurantProfile,
  RestaurantProfileInput,
  RestaurantRepository,
  SaveProfileResult,
  WeeklyOpeningHours,
} from '@/modules/restaurant-profile/types';

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

/** An empty form field means "not filled in yet", which the column stores as NULL. */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable();

function optionalRefined(check: (value: string) => boolean, message: string) {
  return optionalText.refine((value) => value === null || check(value), message);
}

const requiredText = (label: string) => z.string().trim().min(1, `${label} is required.`);

const dayOpeningHours: z.ZodType<DayOpeningHours> = z.union([
  z.object({ closed: z.literal(true) }),
  z.object({
    closed: z.literal(false),
    opens: z.string().regex(TIME_OF_DAY, 'Opening times must look like 09:00.'),
    closes: z.string().regex(TIME_OF_DAY, 'Closing times must look like 22:00.'),
  }),
]);

const profileSchema = z.object({
  name: requiredText('Restaurant name'),
  address: requiredText('Address'),
  country: requiredText('Country'),
  language: requiredText('Language'),
  cuisineType: requiredText('Cuisine type'),
  toneOfVoice: z.enum(TONE_OF_VOICE_VALUES, {
    message: 'Choose one of the listed tones of voice.',
  }),

  logoUrl: optionalRefined(isUrl, 'The logo URL does not look like a valid address.'),
  description: optionalText,
  // partialRecord, not record: a plain record over an enum key demands every
  // day be present, and the form lets days be left blank.
  openingHours: z.partialRecord(z.enum(WEEKDAYS), dayOpeningHours).nullable(),
  website: optionalRefined(isUrl, 'The website does not look like a valid address.'),
  phone: optionalText,
  email: optionalRefined(isEmail, 'The contact email does not look valid.'),
  instagramHandle: optionalText,
  facebookHandle: optionalText,
  tiktokHandle: optionalText,
  brandColors: z
    .array(z.string().regex(HEX_COLOUR, 'Brand colours must be hex codes such as #ff6b35.'))
    .nullable(),
  targetAudience: optionalText,
}) satisfies z.ZodType<RestaurantProfileInput, unknown>;

export async function getProfile(
  ownerId: string,
  repository: RestaurantRepository,
): Promise<RestaurantProfile | null> {
  return repository.findByOwnerId(ownerId);
}

/**
 * Create or update the profile belonging to `ownerId`.
 *
 * The owner is a parameter rather than a form field, so there is no code path
 * in which a request can name the account it writes to.
 */
export async function saveProfile(
  ownerId: string,
  formData: FormData,
  repository: RestaurantRepository,
): Promise<SaveProfileResult> {
  const parsed = profileSchema.safeParse(readProfileForm(formData));

  if (!parsed.success) {
    return { status: 'invalid', message: parsed.error.issues[0]?.message ?? 'Check the form.' };
  }

  await repository.upsertForOwner(ownerId, parsed.data);
  return { status: 'saved' };
}

/** Turns the flat key/value pairs of a form back into the profile's shape. */
export function readProfileForm(formData: FormData): Record<string, unknown> {
  const text = (field: string) => formData.get(field) ?? '';

  return {
    name: text('name'),
    address: text('address'),
    country: text('country'),
    language: text('language'),
    cuisineType: text('cuisineType'),
    toneOfVoice: text('toneOfVoice'),

    logoUrl: text('logoUrl'),
    description: text('description'),
    openingHours: readOpeningHours(formData),
    website: text('website'),
    phone: text('phone'),
    email: text('email'),
    instagramHandle: text('instagramHandle'),
    facebookHandle: text('facebookHandle'),
    tiktokHandle: text('tiktokHandle'),
    brandColors: readBrandColours(formData),
    targetAudience: text('targetAudience'),
  };
}

function readOpeningHours(formData: FormData): WeeklyOpeningHours | null {
  const hours: WeeklyOpeningHours = {};

  for (const weekday of WEEKDAYS) {
    const opens = String(formData.get(`openingHours.${weekday}.opens`) ?? '').trim();
    const closes = String(formData.get(`openingHours.${weekday}.closes`) ?? '').trim();
    const closed = formData.get(`openingHours.${weekday}.closed`) !== null;

    if (closed) {
      hours[weekday] = { closed: true };
    } else if (opens !== '' || closes !== '') {
      hours[weekday] = { closed: false, opens, closes };
    }
  }

  // A form where nobody touched the hours stores NULL rather than seven blanks.
  return Object.keys(hours).length === 0 ? null : hours;
}

function readBrandColours(formData: FormData): string[] | null {
  const colours = String(formData.get('brandColors') ?? '')
    .split(',')
    .map((colour) => colour.trim())
    .filter((colour) => colour !== '');

  return colours.length === 0 ? null : colours;
}

function isUrl(value: string): boolean {
  return z.url().safeParse(value).success;
}

function isEmail(value: string): boolean {
  return z.email().safeParse(value).success;
}
