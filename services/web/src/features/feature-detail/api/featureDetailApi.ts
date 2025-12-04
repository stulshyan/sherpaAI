import axios from 'axios';
import type {
  FeatureDetail,
  FeatureRequirement,
  FeatureQuestion,
  AuditLogEntry,
} from '../types';

const api = axios.create({
  baseURL: '/api/v1',
});

export async function fetchFeatureDetail(featureId: string): Promise<FeatureDetail> {
  const response = await api.get<FeatureDetail>(`/features/${featureId}`);
  return response.data;
}

export async function fetchFeatureRequirements(featureId: string): Promise<FeatureRequirement[]> {
  const response = await api.get<FeatureRequirement[]>(`/features/${featureId}/requirements`);
  return response.data;
}

export async function fetchFeatureQuestions(featureId: string): Promise<FeatureQuestion[]> {
  const response = await api.get<FeatureQuestion[]>(`/features/${featureId}/questions`);
  return response.data;
}

export async function fetchFeatureHistory(featureId: string): Promise<AuditLogEntry[]> {
  const response = await api.get<AuditLogEntry[]>(`/features/${featureId}/history`);
  return response.data;
}

export async function approveFeature(featureId: string): Promise<{
  featureId: string;
  status: string;
  approvedAt: string;
  approvedBy: string;
}> {
  const response = await api.post(`/features/${featureId}/approve`);
  return response.data;
}

export async function startLoop(
  featureId: string,
  loop: 'A' | 'B' | 'C'
): Promise<{
  featureId: string;
  status: string;
  loopStartedAt: string;
}> {
  const response = await api.post(`/features/${featureId}/start-loop`, { loop });
  return response.data;
}

export async function updatePriority(
  featureId: string,
  priorityScore: number
): Promise<{
  featureId: string;
  priorityScore: number;
  updatedAt: string;
}> {
  const response = await api.patch(`/features/${featureId}`, { priorityScore });
  return response.data;
}

export async function answerFeatureQuestion(
  questionId: string,
  answer: string
): Promise<{
  questionId: string;
  answered: boolean;
  answer: string;
  answeredAt: string;
  updatedFeature?: {
    id: string;
    readinessScore: number;
  };
}> {
  const response = await api.post(`/questions/${questionId}/answer`, { answer });
  return response.data;
}
