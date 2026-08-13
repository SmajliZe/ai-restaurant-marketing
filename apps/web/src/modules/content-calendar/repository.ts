import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '@/db/client';
import { calendarEntries } from '@/db/schema';
import type { CalendarDayEntry, ContentCalendarRepository } from '@/modules/content-calendar/types';

function toEntry(row: typeof calendarEntries.$inferSelect): CalendarDayEntry {
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    weekStartDate: row.weekStartDate,
    dayOfWeek: row.dayOfWeek,
    theme: row.theme,
    contentAngle: row.contentAngle,
    isCompleted: row.isCompleted,
    createdAt: row.createdAt,
  };
}

export const contentCalendarRepository: ContentCalendarRepository = {
  async replaceWeek(restaurantId, weekStartDate, entries) {
    // One transaction so a regeneration is never visible half-done: readers
    // either still see last week's plan for these seven days, or all of the
    // new one, never a mix of the two.
    return getDb().transaction(async (tx) => {
      await tx
        .delete(calendarEntries)
        .where(
          and(
            eq(calendarEntries.restaurantId, restaurantId),
            eq(calendarEntries.weekStartDate, weekStartDate),
          ),
        );

      const rows = await tx
        .insert(calendarEntries)
        .values(
          entries.map((entry) => ({
            restaurantId,
            weekStartDate,
            dayOfWeek: entry.dayOfWeek,
            theme: entry.theme,
            contentAngle: entry.contentAngle,
          })),
        )
        .returning();

      return rows.map(toEntry);
    });
  },

  async findByRestaurantIdAndWeek(restaurantId, weekStartDate) {
    const rows = await getDb()
      .select()
      .from(calendarEntries)
      .where(
        and(
          eq(calendarEntries.restaurantId, restaurantId),
          eq(calendarEntries.weekStartDate, weekStartDate),
        ),
      );

    return rows.map(toEntry);
  },

  async toggleCompleted(id, restaurantId) {
    // The WHERE clause is the ownership check: an id that exists but belongs
    // to a different restaurant matches zero rows here, the same as an id
    // that does not exist at all.
    const [row] = await getDb()
      .update(calendarEntries)
      .set({ isCompleted: sql`not ${calendarEntries.isCompleted}` })
      .where(and(eq(calendarEntries.id, id), eq(calendarEntries.restaurantId, restaurantId)))
      .returning();

    return row ? toEntry(row) : null;
  },
};
