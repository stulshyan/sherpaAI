import { useMutation } from '@tanstack/react-query';
import { testApiKey } from '../api';
import type { ModelProvider } from '../types';

export function useApiKeyTest() {
  return useMutation({
    mutationFn: (provider: ModelProvider) => testApiKey(provider),
  });
}
