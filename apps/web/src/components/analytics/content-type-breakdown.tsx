'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { ContentType, ContentTypeBreakdown } from '@/modules/analytics/types';

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  post: 'Posts',
  campaign: 'Campaigns',
  calendar_entry: 'Calendar Entries',
  menu_analysis: 'Menu Analyses',
  style_analysis: 'Style Analyses',
};

type ContentTypeBreakdownChartProps = {
  breakdown: ContentTypeBreakdown[];
};

/**
 * Named `Chart` rather than `ContentTypeBreakdown` (matching the file name)
 * to avoid shadowing the `ContentTypeBreakdown` type it renders.
 */
export function ContentTypeBreakdownChart({ breakdown }: ContentTypeBreakdownChartProps) {
  const data = breakdown.map((entry) => ({
    label: CONTENT_TYPE_LABELS[entry.type],
    count: entry.count,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid stroke="var(--color-slate-800)" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fill: 'var(--color-slate-500)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fill: 'var(--color-slate-300)', fontSize: 13 }}
            axisLine={false}
            tickLine={false}
            width={120}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-surface-muted)' }}
            contentStyle={{
              background: 'var(--color-surface-muted)',
              border: '1px solid var(--color-slate-800)',
              borderRadius: 8,
              fontSize: 13,
            }}
            labelStyle={{ color: 'var(--color-slate-300)' }}
          />
          <Bar dataKey="count" fill="var(--color-accent)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
