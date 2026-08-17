/**
 * One style analysis, as it is stored and read back.
 *
 * No stored images, unlike `GeneratedContentEntry`: the reference
 * screenshots are read once for their patterns and the resulting plan is
 * what has lasting value, not the screenshots themselves - the same reason
 * `MenuAnalysis` does not store the menu photo either.
 */
export type StyleAnalysis = {
  id: string;
  restaurantId: string;
  profileCount: number;
  visualStyleNotes: string;
  contentStyleNotes: string;
  contentPillars: string[];
  recommendations: string[];
  createdAt: Date;
};

/** What `saveStyleAnalysis` needs; the id and timestamp are the database's business. */
export type NewStyleAnalysis = Omit<StyleAnalysis, 'id' | 'restaurantId' | 'createdAt'>;

/** One reference profile's screenshots, as uploaded from the browser. */
export type ProfileImageGroup = {
  feed: File | null;
  posts: File[];
};

/**
 * What the service needs from storage. Declared here so the service can be
 * tested against a fake and stays free of Drizzle - the same reason
 * `MenuAnalysisRepository` exists in the menu-analysis module.
 */
export type StyleAnalysisRepository = {
  create: (restaurantId: string, analysis: NewStyleAnalysis) => Promise<StyleAnalysis>;
  findByRestaurantId: (restaurantId: string) => Promise<StyleAnalysis[]>;
};

export type AnalyzeStyleResult =
  | { status: 'analyzed'; analysis: StyleAnalysis }
  | { status: 'rejected'; message: string };
