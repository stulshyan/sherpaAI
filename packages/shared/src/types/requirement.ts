// Requirement types for Loop 0

import type { UUID, Timestamps } from './common.js';

export type RequirementStatus =
  | 'uploaded'
  | 'extracting'
  | 'extracted'
  | 'classifying'
  | 'classified'
  | 'decomposing'
  | 'decomposed'
  | 'failed';

export type RequirementType = 'new_feature' | 'enhancement' | 'epic' | 'bug_fix' | 'unknown';

export interface Requirement extends Timestamps {
  id: UUID;
  projectId: UUID;
  title: string;
  sourceFileS3Key: string;
  extractedTextS3Key?: string;
  type?: RequirementType;
  typeConfidence?: number;
  status: RequirementStatus;
  errorMessage?: string;
}

export interface CreateRequirementInput {
  projectId: UUID;
  title: string;
  sourceFileS3Key: string;
}

export interface AtomicRequirement {
  id: UUID;
  featureId: UUID;
  text: string;
  clarityScore: number;
  theme?: string;
  dependencies: UUID[];
  order: number;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  confidence: number;
  atomicRequirementIds: UUID[];
}

export interface ClarificationQuestion {
  id: UUID;
  featureId: UUID;
  question: string;
  questionType: 'multiple_choice' | 'yes_no' | 'text' | 'dropdown';
  options?: string[];
  answer?: string;
  answeredAt?: Date;
  answeredBy?: string;
  priority: 'blocking' | 'important' | 'nice_to_have';
}

export interface DecompositionResult {
  requirementId: UUID;
  themes: Theme[];
  atomicRequirements: AtomicRequirement[];
  featureCandidates: FeatureCandidate[];
  clarificationQuestions: ClarificationQuestion[];
  processingTimeMs: number;
  model: string;
}

export interface FeatureCandidate {
  title: string;
  description: string;
  theme: string;
  atomicRequirementIds: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  suggestedPriority: number;
}

export interface ClassificationIndicators {
  hasMultipleThemes: boolean;
  estimatedComplexity: 'low' | 'medium' | 'high';
  scopeIndicators: string[];
  ambiguityFlags: string[];
}

export interface ClassificationResult {
  requirementId: UUID;
  type: RequirementType;
  confidence: number;
  reasoning: string;
  suggestedDecomposition: boolean;
  indicators?: ClassificationIndicators;
}
