import { PanelHeading } from '@/components/content-generation/generated-content-result';
import type { StyleAnalysis } from '@/modules/style-analysis/types';

type StyleAnalysisResultProps = {
  analysis: Pick<
    StyleAnalysis,
    'visualStyleNotes' | 'contentStyleNotes' | 'contentPillars' | 'recommendations'
  >;
};

/**
 * The four sections a style analysis produces, in one place so a fresh
 * result and a past one pulled from the list render identically - the same
 * reason `MenuAnalysisResult` exists, whose `PanelHeading` this reuses
 * rather than redefining.
 */
export function StyleAnalysisResult({ analysis }: StyleAnalysisResultProps) {
  return (
    <div className="flex flex-col gap-4">
      <TextSection heading="Visual style notes" text={analysis.visualStyleNotes} />
      <TextSection heading="Content style notes" text={analysis.contentStyleNotes} />
      <ListSection heading="Content pillars" items={analysis.contentPillars} />
      <ListSection heading="Recommendations" items={analysis.recommendations} />
    </div>
  );
}

function TextSection({ heading, text }: { heading: string; text: string }) {
  return (
    <div className="flex flex-col gap-1">
      <PanelHeading>{heading}</PanelHeading>
      <p className="bg-surface-muted rounded-lg p-4 text-slate-200">{text}</p>
    </div>
  );
}

function ListSection({ heading, items }: { heading: string; items: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <PanelHeading>{heading}</PanelHeading>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item} className="bg-surface-muted rounded-lg p-3 text-sm text-slate-200">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
