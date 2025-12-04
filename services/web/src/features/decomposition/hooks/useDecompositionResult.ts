import { useQuery } from '@tanstack/react-query';
import { fetchDecompositionResult } from '../api/decompositionApi';

export function useDecompositionResult(requirementId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['decomposition-result', requirementId],
    queryFn: () => fetchDecompositionResult(requirementId!),
    enabled: !!requirementId && enabled,
    staleTime: 30000, // 30 seconds
  });
}
