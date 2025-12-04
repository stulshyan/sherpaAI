import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSettings, updateProjectDescription } from '../api';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    staleTime: 60000, // 1 minute - settings don't change often
  });
}

export function useUpdateProjectDescription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (description: string) => updateProjectDescription(description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}
