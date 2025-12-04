import { useQuery } from '@tanstack/react-query';
import { fetchFeatureHistory } from '../api/featureDetailApi';

export function useFeatureHistory(featureId: string | undefined) {
  return useQuery({
    queryKey: ['feature-history', featureId],
    queryFn: () => fetchFeatureHistory(featureId!),
    enabled: !!featureId,
    staleTime: 30000,
  });
}
