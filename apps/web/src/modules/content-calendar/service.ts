import type {
  CalendarDayEntry,
  CalendarWeek,
  ContentCalendarRepository,
  NewCalendarDayEntry,
} from '@/modules/content-calendar/types';

/**
 * The Monday, "YYYY-MM-DD", of the week containing `now`.
 *
 * Computed in UTC and returned as a plain date string rather than a `Date`:
 * a calendar week is a day-granularity concept, and going through a `Date`
 * object would risk the local-timezone shift that made a string column the
 * right choice for `weekStartDate` in the first place.
 */
export function currentWeekStartDate(now: Date = new Date()): string {
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday),
  );
  return monday.toISOString().slice(0, 10);
}

function sortedByDay(entries: CalendarDayEntry[]): CalendarDayEntry[] {
  return [...entries].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

/** Replaces `restaurantId`'s plan for `weekStartDate` with `entries`. */
export async function replaceWeek(
  restaurantId: string,
  weekStartDate: string,
  entries: NewCalendarDayEntry[],
  repository: ContentCalendarRepository,
): Promise<CalendarWeek> {
  const rows = await repository.replaceWeek(restaurantId, weekStartDate, entries);
  return { weekStartDate, entries: sortedByDay(rows) };
}

/** `restaurantId`'s plan for `weekStartDate`, or null when nothing was generated. */
export async function getWeek(
  restaurantId: string,
  weekStartDate: string,
  repository: ContentCalendarRepository,
): Promise<CalendarWeek | null> {
  const entries = await repository.findByRestaurantIdAndWeek(restaurantId, weekStartDate);
  if (entries.length === 0) {
    return null;
  }

  return { weekStartDate, entries: sortedByDay(entries) };
}

/**
 * Flips the completed flag on one entry, but only if it belongs to
 * `restaurantId` - see `ContentCalendarRepository.toggleCompleted`.
 */
export async function toggleCompleted(
  entryId: string,
  restaurantId: string,
  repository: ContentCalendarRepository,
): Promise<CalendarDayEntry | null> {
  return repository.toggleCompleted(entryId, restaurantId);
}
