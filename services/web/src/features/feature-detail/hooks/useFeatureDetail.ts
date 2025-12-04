import { useQuery } from '@tanstack/react-query';
import { fetchFeatureDetail } from '../api/featureDetailApi';

export function useFeatureDetail(featureId: string | undefined) {
  return useQuery({
    queryKey: ['feature', featureId],
    queryFn: () => fetchFeatureDetail(featureId!),
    enabled: !!featureId,
    staleTime: 30000,
  });
}
