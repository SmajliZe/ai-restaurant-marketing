'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { GenerationTrendPoint } from '@/modules/analytics/types';

type GenerationTrendChartProps = {
  trend: GenerationTrendPoint[];
};

/**
 * A 30-day line of daily generation counts. `trend` always has one point per
 * day already - see `buildGenerationTrend` - so there is nothing here to
 * branch on for missing days; the only special case is the Y axis domain
 * below, which keeps an all-zero trend a visible flat line rather than a
 * degenerate, squashed-looking chart.
 */
export function GenerationTrendChart({ trend }: GenerationTrendChartProps) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="var(--color-slate-800)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fill: 'var(--color-slate-500)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--color-slate-800)' }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            domain={[0, (max: number) => Math.max(max, 1)]}
            tick={{ fill: 'var(--color-slate-500)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            formatter={(value) => [value, 'Generated']}
            labelFormatter={(label) => formatFullDate(String(label))}
            contentStyle={{
              background: 'var(--color-surface-muted)',
              border: '1px solid var(--color-slate-800)',
              borderRadius: 8,
              fontSize: 13,
            }}
            labelStyle={{ color: 'var(--color-slate-300)' }}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="var(--color-accent)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatShortDate(dateKey: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T00:00:00Z`));
}

function formatFullDate(dateKey: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T00:00:00Z`));
}
