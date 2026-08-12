export type StickerType = 'poll' | 'question' | 'emoji_slider' | 'countdown';

export type InstagramContent = {
  caption: string;
  hashtags: string[];
};

export type FacebookContent = {
  post: string;
  hashtags: string[];
};

export type StoryContent = {
  text: string;
  cta: string;
  stickerType: StickerType;
  stickerPrompt: string;
};

/**
 * What a fully successful run produces.
 *
 * The two halves of the run - the AI content and the local image enhancement -
 * are independent, so this is the shape you get when both succeed. The outcome
 * types below derive their fields from it rather than restating them.
 */
export type GeneratedContent = {
  recognizedDish: string;
  confidence: number;
  instagram: InstagramContent;
  facebook: FacebookContent;
  story: StoryContent;
  enhancedImageUrl: string;
};

/**
 * The parts of a restaurant's profile that shape the generated content.
 *
 * Read from the session's profile inside the Server Action, never accepted
 * from the caller - see the note on `generateContent`.
 */
export type RestaurantContext = {
  toneOfVoice: string;
  cuisineType: string;
  country: string;
  language: string;
  targetAudience: string | null;
};

export type ContentOutcome =
  | ({ ok: true } & Pick<
      GeneratedContent,
      'recognizedDish' | 'confidence' | 'instagram' | 'facebook' | 'story'
    >)
  | { ok: false; message: string };

export type EnhancementOutcome =
  ({ ok: true } & Pick<GeneratedContent, 'enhancedImageUrl'>) | { ok: false; message: string };

/**
 * `rejected` means nothing ran, because the upload itself was refused.
 * `completed` means both halves were attempted; either may still have failed.
 */
export type GenerateContentResult =
  | { status: 'rejected'; message: string }
  | { status: 'completed'; content: ContentOutcome; enhancement: EnhancementOutcome };
