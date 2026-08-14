'use client';

import { useState } from 'react';

import { MenuAnalysisResult } from '@/components/menu-analysis/menu-analysis-result';
import type { MenuAnalysis } from '@/modules/menu-analysis/types';

type MenuAnalysisItemProps = {
  analysis: MenuAnalysis;
  /** Set for the analysis that was just produced, so it opens already expanded. */
  defaultExpanded?: boolean;
};

/**
 * One row of the analysis list: a short label and the date, collapsed by
 * default. Expanding it shows the full feedback via `MenuAnalysisResult` -
 * the same expand/collapse pattern content-history's `HistoryEntryItem` and
 * content-campaign's `CampaignItem` use for their own rows, reused here
 * rather than a new one.
 */
export function MenuAnalysisItem({ analysis, defaultExpanded = false }: MenuAnalysisItemProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <li
      id={analysis.id}
      className="flex flex-col gap-4 border-b border-slate-800 py-4 last:border-b-0"
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-4 text-left"
        aria-expanded={expanded}
      >
        <div className="flex flex-1 flex-col">
          <span className="font-medium text-slate-100">{truncate(analysis.overview)}</span>
          <span className="text-xs text-slate-500">{formatDate(analysis.createdAt)}</span>
        </div>
        <span className="text-accent shrink-0 text-sm">{expanded ? 'Hide' : 'View'}</span>
      </button>

      {expanded && <MenuAnalysisResult analysis={analysis} />}
    </li>
  );
}

function truncate(text: string, maxLength = 80): string {
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}

function formatDate(date: Date): string {
  // A fixed timeZone, rather than the runtime's own: without one, this
  // renders in the server's local zone during SSR and the browser's local
  // zone during hydration, and whenever those differ React discards the
  // server-rendered tree as a hydration mismatch. No per-restaurant
  // timezone is tracked yet, so UTC is the deterministic choice that keeps
  // server and client in agreement.
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date);
}
