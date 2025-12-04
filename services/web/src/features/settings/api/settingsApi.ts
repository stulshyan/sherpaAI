import axios from 'axios';
import type { ApiKeyTestResult, ModelProvider, SettingsData } from '../types';

const api = axios.create({
  baseURL: '/api/v1',
});

export async function fetchSettings(): Promise<SettingsData> {
  const response = await api.get<SettingsData>('/settings');
  return response.data;
}

export async function testApiKey(provider: ModelProvider): Promise<ApiKeyTestResult> {
  const response = await api.post<ApiKeyTestResult>('/settings/test-api-key', { provider });
  return response.data;
}

export async function updateProjectDescription(description: string): Promise<{ success: boolean }> {
  const response = await api.patch<{ success: boolean }>('/settings/project', { description });
  return response.data;
}
