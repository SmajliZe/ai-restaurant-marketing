/** One planned day. `weekStartDate` is that week's Monday, "YYYY-MM-DD". */
export type CalendarDayEntry = {
  id: string;
  restaurantId: string;
  weekStartDate: string;
  dayOfWeek: number;
  theme: string;
  contentAngle: string;
  isCompleted: boolean;
  createdAt: Date;
};

/** What a freshly generated day needs; the rest is the database's business. */
export type NewCalendarDayEntry = {
  dayOfWeek: number;
  theme: string;
  contentAngle: string;
};

/** A week's plan, entries sorted Monday through Sunday. */
export type CalendarWeek = {
  weekStartDate: string;
  entries: CalendarDayEntry[];
};

/**
 * What the service needs from storage. Declared here so the service can be
 * tested against a fake and stays free of Drizzle - the same reason
 * `ContentHistoryRepository` exists in the content-history module.
 */
export type ContentCalendarRepository = {
  /** Deletes any existing rows for the week, then inserts the new ones, in one transaction. */
  replaceWeek: (
    restaurantId: string,
    weekStartDate: string,
    entries: NewCalendarDayEntry[],
  ) => Promise<CalendarDayEntry[]>;
  findByRestaurantIdAndWeek: (
    restaurantId: string,
    weekStartDate: string,
  ) => Promise<CalendarDayEntry[]>;
  /**
   * Flips `isCompleted` for `id`, but only if it belongs to `restaurantId`.
   *
   * Returns null when the id does not exist or belongs to a different
   * restaurant - the two are indistinguishable on purpose, so a guessed id
   * never reveals whether it was real.
   */
  toggleCompleted: (id: string, restaurantId: string) => Promise<CalendarDayEntry | null>;
};

export type GenerateWeeklyCalendarResult =
  { status: 'generated'; week: CalendarWeek } | { status: 'rejected'; message: string };
