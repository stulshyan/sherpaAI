import { useQuery } from '@tanstack/react-query';
import { fetchFeatureRequirements } from '../api/featureDetailApi';

export function useFeatureRequirements(featureId: string | undefined) {
  return useQuery({
    queryKey: ['feature-requirements', featureId],
    queryFn: () => fetchFeatureRequirements(featureId!),
    enabled: !!featureId,
    staleTime: 30000,
  });
}
