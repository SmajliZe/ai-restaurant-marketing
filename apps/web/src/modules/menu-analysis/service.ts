import type {
  MenuAnalysis,
  MenuAnalysisRepository,
  NewMenuAnalysis,
} from '@/modules/menu-analysis/types';

/** Stores a freshly generated analysis under `restaurantId`. */
export async function saveMenuAnalysis(
  restaurantId: string,
  analysis: NewMenuAnalysis,
  repository: MenuAnalysisRepository,
): Promise<MenuAnalysis> {
  return repository.create(restaurantId, analysis);
}

/** `restaurantId`'s own past analyses, newest first. */
export async function getMenuAnalyses(
  restaurantId: string,
  repository: MenuAnalysisRepository,
): Promise<MenuAnalysis[]> {
  return repository.findByRestaurantId(restaurantId);
}
