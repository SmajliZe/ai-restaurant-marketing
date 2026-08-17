import type {
  NewStyleAnalysis,
  StyleAnalysis,
  StyleAnalysisRepository,
} from '@/modules/style-analysis/types';

/** Stores a freshly generated style analysis under `restaurantId`. */
export async function saveStyleAnalysis(
  restaurantId: string,
  analysis: NewStyleAnalysis,
  repository: StyleAnalysisRepository,
): Promise<StyleAnalysis> {
  return repository.create(restaurantId, analysis);
}

/** `restaurantId`'s own past style analyses, newest first. */
export async function getStyleAnalyses(
  restaurantId: string,
  repository: StyleAnalysisRepository,
): Promise<StyleAnalysis[]> {
  return repository.findByRestaurantId(restaurantId);
}
