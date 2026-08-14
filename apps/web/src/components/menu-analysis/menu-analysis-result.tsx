import { PanelHeading } from '@/components/content-generation/generated-content-result';
import type { MenuAnalysis } from '@/modules/menu-analysis/types';

type MenuAnalysisResultProps = {
  analysis: Pick<
    MenuAnalysis,
    | 'overview'
    | 'pricingNotes'
    | 'descriptionQuality'
    | 'upsellingIdeas'
    | 'crossSellingIdeas'
    | 'missingItems'
    | 'improvementSuggestions'
  >;
};

/**
 * The feedback sections one analysis produces, in one place so a fresh
 * result and a past one pulled from the list render identically - the same
 * reason `ContentPanel` exists in generated-content-result.tsx, whose
 * `PanelHeading` this reuses rather than redefining.
 *
 * Missing items is the one section shown conditionally: an empty list is a
 * valid result (no obvious gaps), not something worth a heading over.
 */
export function MenuAnalysisResult({ analysis }: MenuAnalysisResultProps) {
  return (
    <div className="flex flex-col gap-4">
      <TextSection heading="Overview" text={analysis.overview} />
      <TextSection heading="Pricing notes" text={analysis.pricingNotes} />
      <TextSection heading="Description quality" text={analysis.descriptionQuality} />
      <ListSection heading="Upselling ideas" items={analysis.upsellingIdeas} />
      <ListSection heading="Cross-selling ideas" items={analysis.crossSellingIdeas} />
      {analysis.missingItems.length > 0 && (
        <ListSection heading="Missing items" items={analysis.missingItems} />
      )}
      <ListSection heading="Improvement suggestions" items={analysis.improvementSuggestions} />
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
