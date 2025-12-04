import { useQuery } from '@tanstack/react-query';
import { fetchFeatureQuestions } from '../api/featureDetailApi';

export function useFeatureQuestions(featureId: string | undefined) {
  return useQuery({
    queryKey: ['feature-questions', featureId],
    queryFn: () => fetchFeatureQuestions(featureId!),
    enabled: !!featureId,
    staleTime: 30000,
  });
}
