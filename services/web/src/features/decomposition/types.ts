// Decomposition Types

export interface DecompositionStatus {
  requirementId: string;
  status: DecompositionStage;
  progress: number; // 0-100
  currentStage: string; // Human-readable stage description
  estimatedTimeRemaining?: number; // Seconds
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export type DecompositionStage =
  | 'queued'
  | 'extracting'
  | 'classifying'
  | 'decomposing'
  | 'scoring'
  | 'completed'
  | 'failed';

export interface DecompositionResult {
  requirementId: string;
  version: number;
  themes: Theme[];
  atomicRequirements: AtomicRequirement[];
  featureCandidates: FeatureCandidate[];
  clarificationQuestions: ClarificationQuestion[];
  summary: DecompositionSummary;
  decomposedAt: string;
}

export interface Theme {
  id: string;
  label: string;
  confidence: number;
  domain: string;
  description: string;
  relatedFeatures: string[]; // Feature IDs
  color?: string; // For UI display
}

export interface AtomicRequirement {
  id: string;
  themeId: string;
  featureId: string;
  text: string;
  clarity: number;
  testable: boolean;
  dependencies: string[];
  acceptanceCriteria?: string[];
  ambiguityNotes?: string;
}

export interface FeatureCandidate {
  id: string;
  title: string;
  description: string;
  themeIds: string[];
  childRequirements: string[]; // AR IDs
  estimatedComplexity: 'low' | 'medium' | 'high' | 'very_high';
  readinessScore: number;
  suggestedPriority: number;
  tags: string[];
  pendingQuestions: number;
}

export interface ClarificationQuestion {
  id: string;
  featureId: string;
  question: string;
  questionType: QuestionType;
  options?: string[];
  defaultAnswer?: string;
  impact: 'blocking' | 'clarifying' | 'optional';
  category: 'business' | 'technical' | 'compliance' | 'scope';
  answered: boolean;
  answer?: string;
  answeredAt?: string;
}

export type QuestionType = 'multiple_choice' | 'yes_no' | 'text' | 'dropdown';

export interface DecompositionSummary {
  totalThemes: number;
  totalFeatures: number;
  totalAtomicRequirements: number;
  totalQuestions: number;
  blockingQuestions: number;
  averageClarity: number;
  estimatedComplexity: 'low' | 'medium' | 'high' | 'epic';
  recommendedFirstFeature: {
    id: string;
    title: string;
  };
}

export interface AnswerQuestionResponse {
  questionId: string;
  answered: boolean;
  answer: string;
  answeredAt: string;
  updatedFeature?: {
    id: string;
    readinessScore: number;
  };
}

// Processing stages configuration
export const PROCESSING_STAGES: Array<{
  key: DecompositionStage;
  label: string;
  progress: number;
}> = [
  { key: 'extracting', label: 'Extracting text', progress: 25 },
  { key: 'classifying', label: 'Classifying requirement', progress: 40 },
  { key: 'decomposing', label: 'Decomposing into features', progress: 85 },
  { key: 'scoring', label: 'Calculating readiness scores', progress: 95 },
  { key: 'completed', label: 'Complete', progress: 100 },
];

// Helper functions
export function getStageIndex(stage: DecompositionStage): number {
  const index = PROCESSING_STAGES.findIndex((s) => s.key === stage);
  return index === -1 ? 0 : index;
}

export function getClarityColor(clarity: number): string {
  if (clarity >= 0.8) return 'text-green-600 dark:text-green-400';
  if (clarity >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

export function getClarityBgColor(clarity: number): string {
  if (clarity >= 0.8) return 'bg-green-100 dark:bg-green-900/30';
  if (clarity >= 0.6) return 'bg-yellow-100 dark:bg-yellow-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
}

export function getReadinessColor(score: number): string {
  if (score >= 0.8) return 'bg-green-500';
  if (score >= 0.6) return 'bg-yellow-500';
  return 'bg-gray-400';
}

export function getComplexityLabel(complexity: string): { label: string; color: string } {
  const config: Record<string, { label: string; color: string }> = {
    low: { label: 'Low', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    high: { label: 'High', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    very_high: { label: 'Very High', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  };
  return config[complexity] || config.medium;
}
