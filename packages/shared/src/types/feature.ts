// Feature and backlog types

import type { UUID, Timestamps } from './common.js';
import type { ClarificationQuestion, AtomicRequirement } from './requirement.js';

export type FeatureStatus =
  | 'draft'
  | 'needs_clarification'
  | 'ready'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'cancelled';

export type DependencyType = 'blocks' | 'related' | 'parent';

export interface Feature extends Timestamps {
  id: UUID;
  requirementId: UUID;
  projectId: UUID;
  title: string;
  description: string;
  status: FeatureStatus;
  priorityScore: number;
  readinessScore: number;
  parentFeatureId?: UUID;
  theme?: string;
}

export interface FeatureReadiness {
  featureId: UUID;
  overall: number; // 0-1
  businessClarity: number;
  technicalClarity: number;
  testability: number;
  blockingQuestions: ClarificationQuestion[];
  lastUpdated: Date;
}

export interface FeatureDependency {
  featureId: UUID;
  dependsOnFeatureId: UUID;
  dependencyType: DependencyType;
}

export interface PriorityScore {
  overall: number;
  factors: {
    businessValue: number;
    complexity: number;
    urgency: number;
    readiness: number;
    dependencies: number;
  };
}

export interface PriorityWeights {
  businessValue: number;
  complexity: number;
  urgency: number;
  readiness: number;
  dependencies: number;
}

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  businessValue: 0.35,
  urgency: 0.25,
  readiness: 0.2,
  complexity: -0.15, // Penalty
  dependencies: -0.05, // Penalty for blocked items
};

export interface FeatureWithDetails extends Feature {
  readiness: FeatureReadiness;
  atomicRequirements: AtomicRequirement[];
  clarificationQuestions: ClarificationQuestion[];
  dependencies: FeatureDependency[];
  dependents: FeatureDependency[];
}

// Backlog views
export interface BacklogView {
  name: string;
  features: Feature[];
  count: number;
}

export interface BacklogSummary {
  nowPlaying: BacklogView;
  readySoon: BacklogView;
  needsAttention: BacklogView;
  waiting: BacklogView;
}

// Audit trail
export interface AuditLogEntry {
  id: UUID;
  entityType: 'requirement' | 'feature' | 'question' | 'execution';
  entityId: UUID;
  action: string;
  actor: string;
  details: Record<string, unknown>;
  createdAt: Date;
}
