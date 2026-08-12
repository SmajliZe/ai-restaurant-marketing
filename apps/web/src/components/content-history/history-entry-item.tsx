'use client';

import { useState } from 'react';

import { ContentPanel } from '@/components/content-generation/generated-content-result';
import type { GeneratedContentEntry } from '@/modules/content-history/types';

/**
 * One row of history: a thumbnail, the dish, and the date, collapsed by
 * default. Expanding it shows the same Instagram/Facebook/Story panel a
 * fresh generation does, via `ContentPanel` - there is no second copy of
 * that rendering logic here.
 */
export function HistoryEntryItem({ entry }: { entry: GeneratedContentEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li
      id={entry.id}
      className="flex flex-col gap-4 border-b border-slate-800 py-4 last:border-b-0"
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-4 text-left"
        aria-expanded={expanded}
      >
        {/* eslint-disable-next-line @next/next/no-img-element --
            Same reasoning as generated-content-result.tsx: this is a stored
            photo served from our own route, not something next/image needs
            to optimise. */}
        <img
          src={entry.enhancedImagePath}
          alt={`Enhanced photo of ${entry.recognizedDish}`}
          className="bg-surface-muted h-16 w-16 shrink-0 rounded-lg object-cover"
        />
        <div className="flex flex-1 flex-col">
          <span className="font-medium text-slate-100">{entry.recognizedDish}</span>
          <span className="text-xs text-slate-500">{formatDate(entry.createdAt)}</span>
        </div>
        <span className="text-accent shrink-0 text-sm">{expanded ? 'Hide' : 'View'}</span>
      </button>

      {expanded && (
        <ContentPanel
          recognizedDish={entry.recognizedDish}
          confidence={entry.confidence}
          instagram={entry.instagram}
          facebook={entry.facebook}
          story={entry.story}
        />
      )}
    </li>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
