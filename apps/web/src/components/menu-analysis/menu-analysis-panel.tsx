'use client';

import { useState, useTransition } from 'react';

import { ImageUploadForm } from '@/components/content-generation/image-upload-form';
import { MenuAnalysisItem } from '@/components/menu-analysis/menu-analysis-item';
import { analyzeMenu } from '@/modules/menu-analysis/actions';
import type { MenuAnalysis } from '@/modules/menu-analysis/types';

type MenuAnalysisPanelProps = {
  /** What the page found on load. */
  initialAnalyses: MenuAnalysis[];
};

export function MenuAnalysisPanel({ initialAnalyses }: MenuAnalysisPanelProps) {
  const [analyses, setAnalyses] = useState(initialAnalyses);
  const [justAnalyzedId, setJustAnalyzedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAnalyze(file: File) {
    setMessage(null);
    startTransition(async () => {
      const result = await analyzeMenu(file);
      if (result.status === 'rejected') {
        setMessage(result.message);
        return;
      }
      setAnalyses((current) => [result.analysis, ...current]);
      setJustAnalyzedId(result.analysis.id);
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <ImageUploadForm
        onGenerate={handleAnalyze}
        isPending={isPending}
        label="Photo of the menu"
        submitLabel="Analyze menu"
        pendingLabel="Analyzing…"
      />

      {message !== null && (
        <p
          role="alert"
          className="rounded-lg border border-rose-900/60 bg-rose-950/30 p-4 text-sm text-rose-200"
        >
          {message}
        </p>
      )}

      {analyses.length === 0 ? (
        <p className="text-sm text-slate-400">
          No menus analyzed yet. Upload a photo of your menu to get started.
        </p>
      ) : (
        <ul className="flex flex-col">
          {analyses.map((analysis) => (
            <MenuAnalysisItem
              key={analysis.id}
              analysis={analysis}
              defaultExpanded={analysis.id === justAnalyzedId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
