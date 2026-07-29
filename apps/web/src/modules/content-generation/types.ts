/**
 * What a fully successful run produces.
 *
 * The two halves of the run - the AI caption and the local image enhancement -
 * are independent, so this is the shape you get when both succeed. The outcome
 * types below derive their fields from it rather than restating them.
 */
export type GeneratedContent = {
  recognizedDish: string;
  caption: string;
  hashtags: string[];
  enhancedImageUrl: string;
};

export type CaptionOutcome =
  | ({ ok: true } & Pick<GeneratedContent, 'recognizedDish' | 'caption' | 'hashtags'>)
  | { ok: false; message: string };

export type EnhancementOutcome =
  ({ ok: true } & Pick<GeneratedContent, 'enhancedImageUrl'>) | { ok: false; message: string };

/**
 * `rejected` means nothing ran, because the upload itself was refused.
 * `completed` means both halves were attempted; either may still have failed.
 */
export type GenerateContentResult =
  | { status: 'rejected'; message: string }
  | { status: 'completed'; caption: CaptionOutcome; enhancement: EnhancementOutcome };
