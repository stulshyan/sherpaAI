import axios from 'axios';
import type { DecompositionStatus, DecompositionResult, AnswerQuestionResponse } from '../types';

const api = axios.create({
  baseURL: '/api/v1',
});

export async function fetchDecompositionStatus(requirementId: string): Promise<DecompositionStatus> {
  const response = await api.get<DecompositionStatus>(
    `/requirements/${requirementId}/decomposition/status`
  );
  return response.data;
}

export async function fetchDecompositionResult(requirementId: string): Promise<DecompositionResult> {
  const response = await api.get<DecompositionResult>(
    `/requirements/${requirementId}/decomposition`
  );
  return response.data;
}

export async function submitAnswer(
  questionId: string,
  answer: string
): Promise<AnswerQuestionResponse> {
  const response = await api.post<AnswerQuestionResponse>(`/questions/${questionId}/answer`, {
    answer,
  });
  return response.data;
}

export async function retryDecomposition(requirementId: string): Promise<{ success: boolean }> {
  const response = await api.post<{ success: boolean }>(
    `/requirements/${requirementId}/decomposition/retry`
  );
  return response.data;
}
