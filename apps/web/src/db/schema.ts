import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const TONE_OF_VOICE_VALUES = [
  'friendly',
  'luxury',
  'modern',
  'family',
  'premium',
  'minimalistic',
  'humorous',
] as const;

export type ToneOfVoice = (typeof TONE_OF_VOICE_VALUES)[number];

export const toneOfVoice = pgEnum('tone_of_voice', TONE_OF_VOICE_VALUES);

export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

/** Times are "HH:MM" on a 24-hour clock, in the restaurant's own local time. */
export type DayOpeningHours = { closed: true } | { closed: false; opens: string; closes: string };

/**
 * Partial because a restaurant can fill in the days it is sure about and leave
 * the rest for later; a missing day means "not stated", not "closed".
 */
export type WeeklyOpeningHours = Partial<Record<Weekday, DayOpeningHours>>;

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Stored lowercased by the registration service so that "A@b.com" and
  // "a@b.com" cannot both be registered; the unique index is case-sensitive.
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const restaurants = pgTable('restaurants', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Unique, because an account owns exactly one restaurant for the MVP. Making
  // it a one-to-many later means dropping this constraint, not reshaping rows.
  ownerId: uuid('owner_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Required at creation. Everything below this block can be filled in later.
  name: text('name').notNull(),
  address: text('address').notNull(),
  country: text('country').notNull(),
  language: text('language').notNull(),
  cuisineType: text('cuisine_type').notNull(),
  toneOfVoice: toneOfVoice('tone_of_voice').notNull(),

  logoUrl: text('logo_url'),
  description: text('description'),

  // jsonb rather than text: opening hours are structured data the product will
  // have to reason about ("open until 22:00 tonight"), and a free-text field
  // could only ever be echoed back verbatim. jsonb also lets Postgres index and
  // query into it if that is ever needed, which text cannot.
  openingHours: jsonb('opening_hours').$type<WeeklyOpeningHours>(),

  website: text('website'),
  phone: text('phone'),
  email: text('email'),
  instagramHandle: text('instagram_handle'),
  facebookHandle: text('facebook_handle'),
  tiktokHandle: text('tiktok_handle'),

  /** Hex colours such as "#ff6b35", in the order the brand uses them. */
  brandColors: jsonb('brand_colors').$type<string[]>(),
  targetAudience: text('target_audience'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type RestaurantRow = typeof restaurants.$inferSelect;
export type NewRestaurantRow = typeof restaurants.$inferInsert;

// Mirrors app.schemas.content_generation.StickerType in the AI service - the
// two never drift apart because both spell out the same four values by hand.
export const STICKER_TYPE_VALUES = ['poll', 'question', 'emoji_slider', 'countdown'] as const;

export type StickerTypeValue = (typeof STICKER_TYPE_VALUES)[number];

export const stickerType = pgEnum('sticker_type', STICKER_TYPE_VALUES);

export const generatedContent = pgTable('generated_content', {
  id: uuid('id').primaryKey().defaultRandom(),

  // A restaurant's history disappears with the restaurant, the same way a
  // profile's opening hours would - there is no scenario where a leftover
  // history row for a deleted restaurant is useful to anyone.
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),

  recognizedDish: text('recognized_dish').notNull(),
  confidence: real('confidence').notNull(),

  instagramCaption: text('instagram_caption').notNull(),
  instagramHashtags: jsonb('instagram_hashtags').$type<string[]>().notNull(),

  facebookPost: text('facebook_post').notNull(),
  facebookHashtags: jsonb('facebook_hashtags').$type<string[]>().notNull(),

  storyText: text('story_text').notNull(),
  storyCta: text('story_cta').notNull(),
  storyStickerType: stickerType('story_sticker_type').notNull(),
  storyStickerPrompt: text('story_sticker_prompt').notNull(),

  // The URL the browser fetches the enhanced photo from (see
  // enhanced-image-store.ts), not a filesystem path - "path" here matches
  // what the photo behind it is, not the shape of the string.
  enhancedImagePath: text('enhanced_image_path').notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type GeneratedContentRow = typeof generatedContent.$inferSelect;
export type NewGeneratedContentRow = typeof generatedContent.$inferInsert;

export const calendarEntries = pgTable(
  'calendar_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // A restaurant's plan disappears with the restaurant, same as its
    // history - see the note on generatedContent.restaurantId.
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),

    // The Monday of the week this entry belongs to. A date, not a
    // timestamp: it identifies a calendar week, not a moment, and storing
    // it as a plain "YYYY-MM-DD" string sidesteps any timezone conversion
    // that could otherwise shift it onto the wrong day.
    weekStartDate: date('week_start_date').notNull(),

    // 0 = Monday .. 6 = Sunday, matching the AI service's CalendarEntry.
    dayOfWeek: integer('day_of_week').notNull(),

    theme: text('theme').notNull(),
    contentAngle: text('content_angle').notNull(),

    isCompleted: boolean('is_completed').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Regenerating a week replaces its rows (delete + insert in one
    // transaction) rather than relying on this to prevent duplicates, but
    // the constraint means a bug in that logic fails loudly at the database
    // instead of quietly leaving two entries for the same day.
    uniqueIndex('calendar_entries_restaurant_week_day_unique').on(
      table.restaurantId,
      table.weekStartDate,
      table.dayOfWeek,
    ),
  ],
);

export type CalendarEntryRow = typeof calendarEntries.$inferSelect;
export type NewCalendarEntryRow = typeof calendarEntries.$inferInsert;

// Mirrors CampaignStatus in the content-campaign module - the two never
// drift apart because both spell out the same three values by hand.
export const CAMPAIGN_STATUS_VALUES = ['draft', 'active', 'completed'] as const;

export type CampaignStatusValue = (typeof CAMPAIGN_STATUS_VALUES)[number];

export const campaignStatus = pgEnum('campaign_status', CAMPAIGN_STATUS_VALUES);

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),

  // A restaurant's campaigns disappear with the restaurant, same as its
  // history and its plan - see the note on generatedContent.restaurantId.
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),

  occasion: text('occasion').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  // The shape of an offer, e.g. "a complimentary starter with any main
  // course" - never a specific price, per the AI service's own rule.
  offer: text('offer').notNull(),
  caption: text('caption').notNull(),
  hashtags: jsonb('hashtags').$type<string[]>().notNull(),

  storyText: text('story_text').notNull(),
  storyCta: text('story_cta').notNull(),
  storyStickerType: stickerType('story_sticker_type').notNull(),
  storyStickerPrompt: text('story_sticker_prompt').notNull(),

  cta: text('cta').notNull(),
  durationSuggestion: text('duration_suggestion').notNull(),

  status: campaignStatus('status').notNull().default('draft'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type CampaignRow = typeof campaigns.$inferSelect;
export type NewCampaignRow = typeof campaigns.$inferInsert;

export const menuAnalyses = pgTable('menu_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),

  // A restaurant's analyses disappear with the restaurant, same as its
  // history, plan, and campaigns - see the note on generatedContent.restaurantId.
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),

  // No stored image, unlike generatedContent: the photo is read once for
  // its text (items, prices, descriptions) and the feedback is what has
  // lasting value, not the photo itself.
  overview: text('overview').notNull(),
  pricingNotes: text('pricing_notes').notNull(),
  descriptionQuality: text('description_quality').notNull(),
  upsellingIdeas: jsonb('upselling_ideas').$type<string[]>().notNull(),
  crossSellingIdeas: jsonb('cross_selling_ideas').$type<string[]>().notNull(),
  missingItems: jsonb('missing_items').$type<string[]>().notNull(),
  improvementSuggestions: jsonb('improvement_suggestions').$type<string[]>().notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type MenuAnalysisRow = typeof menuAnalyses.$inferSelect;
export type NewMenuAnalysisRow = typeof menuAnalyses.$inferInsert;
