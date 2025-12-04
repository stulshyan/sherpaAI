import { useQuery } from '@tanstack/react-query';
import { fetchDecompositionStatus } from '../api/decompositionApi';

export function useDecompositionStatus(requirementId: string | undefined) {
  return useQuery({
    queryKey: ['decomposition-status', requirementId],
    queryFn: () => fetchDecompositionStatus(requirementId!),
    refetchInterval: (query) => {
      const data = query.state.data;
      // Poll every 2s while processing, stop when complete/failed
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 2000;
    },
    enabled: !!requirementId,
  });
}
