'use client';

import { useState } from 'react';

import { StyleAnalysisResult } from '@/components/style-analysis/style-analysis-result';
import type { StyleAnalysis } from '@/modules/style-analysis/types';

type StyleAnalysisItemProps = {
  analysis: StyleAnalysis;
  /** Set for the analysis that was just produced, so it opens already expanded. */
  defaultExpanded?: boolean;
};

/**
 * One row of the analysis list: how many reference profiles it was built
 * from and the date, collapsed by default. Expanding it shows the full
 * plan via `StyleAnalysisResult` - the same expand/collapse pattern
 * content-history's `HistoryEntryItem`, content-campaign's `CampaignItem`,
 * and menu-analysis's `MenuAnalysisItem` use for their own rows, reused
 * here rather than a new one.
 */
export function StyleAnalysisItem({ analysis, defaultExpanded = false }: StyleAnalysisItemProps) {
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
          <span className="font-medium text-slate-100">
            Based on {analysis.profileCount}{' '}
            {analysis.profileCount === 1 ? 'reference profile' : 'reference profiles'}
          </span>
          <span className="text-xs text-slate-500">
            {new Intl.DateTimeFormat('en', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'UTC',
            }).format(analysis.createdAt)}
          </span>
        </div>
        <span className="text-accent shrink-0 text-sm">{expanded ? 'Hide' : 'View'}</span>
      </button>

      {expanded && <StyleAnalysisResult analysis={analysis} />}
    </li>
  );
}
