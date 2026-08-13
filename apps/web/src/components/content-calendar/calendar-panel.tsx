'use client';

import { useState, useTransition } from 'react';

import { generateWeeklyCalendar, toggleEntryCompleted } from '@/modules/content-calendar/actions';
import type { CalendarDayEntry, CalendarWeek } from '@/modules/content-calendar/types';

const DAY_LABELS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

const REGENERATE_WARNING =
  "Regenerating replaces this week's plan, including any days you have already checked off. Continue?";

type CalendarPanelProps = {
  /** What the page found on load. Null means no plan exists for this week yet. */
  initialWeek: CalendarWeek | null;
};

export function CalendarPanel({ initialWeek }: CalendarPanelProps) {
  const [week, setWeek] = useState(initialWeek);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    // Only ask when there is something a regeneration could actually take
    // away - a first generation has no prior state to lose.
    if (week !== null && !window.confirm(REGENERATE_WARNING)) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await generateWeeklyCalendar();
      if (result.status === 'rejected') {
        setMessage(result.message);
        return;
      }
      setWeek(result.week);
    });
  }

  function handleToggle(entryId: string) {
    setWeek((current) => {
      if (current === null) {
        return current;
      }
      return {
        ...current,
        entries: current.entries.map((entry) =>
          entry.id === entryId ? { ...entry, isCompleted: !entry.isCompleted } : entry,
        ),
      };
    });

    // Optimistic: the checkbox flips immediately, and the request that
    // makes it durable happens in the background. If the entry turns out
    // not to be the caller's own, the server quietly no-ops and the next
    // full load of the page shows the real state.
    startTransition(async () => {
      await toggleEntryCompleted(entryId);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending}
          className="bg-accent w-fit rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending
            ? 'Working…'
            : week === null
              ? "Generate this week's plan"
              : 'Regenerate this week'}
        </button>
        {week !== null && (
          <span className="text-xs text-slate-500">Week of {week.weekStartDate}</span>
        )}
      </div>

      {message !== null && (
        <p
          role="alert"
          className="rounded-lg border border-rose-900/60 bg-rose-950/30 p-4 text-sm text-rose-200"
        >
          {message}
        </p>
      )}

      {week === null ? (
        <p className="text-sm text-slate-400">
          Nothing planned for this week yet. Generate a plan to get a theme and content angle for
          each day.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {week.entries.map((entry) => (
            <DayCard
              key={entry.id}
              label={DAY_LABELS[entry.dayOfWeek] ?? 'Day'}
              entry={entry}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DayCard({
  label,
  entry,
  onToggle,
}: {
  label: string;
  entry: CalendarDayEntry;
  onToggle: (entryId: string) => void;
}) {
  return (
    <div className="bg-surface-muted flex flex-col gap-3 rounded-lg p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-widest text-slate-500 uppercase">
          {label}
        </span>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={entry.isCompleted}
            onChange={() => onToggle(entry.id)}
            className="accent-accent"
          />
          Done
        </label>
      </div>
      <h3 className="text-lg font-medium text-slate-100">{entry.theme}</h3>
      <p className="text-sm text-slate-300">{entry.contentAngle}</p>
    </div>
  );
}
