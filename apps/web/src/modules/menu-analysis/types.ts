/**
 * One menu analysis, as it is stored and read back.
 *
 * No stored image, unlike `GeneratedContentEntry`: the photo is read once
 * for its text and the feedback is what has lasting value, not the photo
 * itself - see the note on `menuAnalyses` in db/schema.ts.
 */
export type MenuAnalysis = {
  id: string;
  restaurantId: string;
  overview: string;
  pricingNotes: string;
  descriptionQuality: string;
  upsellingIdeas: string[];
  crossSellingIdeas: string[];
  missingItems: string[];
  improvementSuggestions: string[];
  createdAt: Date;
};

/** What `saveMenuAnalysis` needs; the id and timestamp are the database's business. */
export type NewMenuAnalysis = Omit<MenuAnalysis, 'id' | 'restaurantId' | 'createdAt'>;

/**
 * What the service needs from storage. Declared here so the service can be
 * tested against a fake and stays free of Drizzle - the same reason
 * `ContentCampaignRepository` exists in the content-campaign module.
 */
export type MenuAnalysisRepository = {
  create: (restaurantId: string, analysis: NewMenuAnalysis) => Promise<MenuAnalysis>;
  findByRestaurantId: (restaurantId: string) => Promise<MenuAnalysis[]>;
};

export type AnalyzeMenuResult =
  | { status: 'analyzed'; analysis: MenuAnalysis }
  | { status: 'rejected'; message: string };
