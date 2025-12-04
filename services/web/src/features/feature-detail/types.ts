// Feature Detail Types

export interface FeatureDetail {
  id: string;
  title: string;
  description: string;
  status: FeatureDetailStatus;

  // Scores
  readinessScore: number;
  readinessBreakdown: {
    businessClarity: number;
    technicalClarity: number;
    testability: number;
    completeness: number;
  };
  priorityScore: number;
  priorityFactors: {
    businessValue: number;
    urgency: number;
    complexity: number;
    readiness: number;
    dependencies: number;
  };

  // Metadata
  estimatedComplexity: 'low' | 'medium' | 'high' | 'very_high';
  tags: string[];
  themeIds: string[];

  // Dependencies
  dependencies: FeatureDependency[];
  blockedBy: string[]; // Feature IDs blocking this
  blocks: string[]; // Features this blocks

  // Counts
  requirementCount: number;
  questionCount: number;
  blockingQuestionCount: number;

  // Loop status
  currentLoop?: 'A' | 'B' | 'C';
  loopProgress?: number;
  approvedAt?: string;
  approvedBy?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  projectId: string;
}

export type FeatureDetailStatus =
  | 'backlog'
  | 'approved'
  | 'in_loop_a'
  | 'in_loop_b'
  | 'in_loop_c'
  | 'blocked'
  | 'needs_clarification'
  | 'deferred'
  | 'deployed_staging'
  | 'deployed_production';

export interface FeatureDependency {
  featureId: string;
  featureTitle: string;
  dependencyType: 'blocks' | 'related' | 'parent';
  status: FeatureDetailStatus;
}

export interface FeatureRequirement {
  id: string;
  text: string;
  clarity: number;
  testable: boolean;
  themeId: string;
  themeName: string;
  acceptanceCriteria?: string[];
}

export interface AuditLogEntry {
  id: string;
  featureId: string;
  action: AuditAction;
  timestamp: string;
  actor: {
    id: string;
    name: string;
    type: 'user' | 'system';
  };
  details: Record<string, unknown>;
  previousValue?: unknown;
  newValue?: unknown;
}

export type AuditAction =
  | 'created'
  | 'updated'
  | 'question_answered'
  | 'readiness_updated'
  | 'priority_override'
  | 'approved'
  | 'loop_started'
  | 'loop_completed'
  | 'deployed_staging'
  | 'deployed_production'
  | 'status_changed';

export type FeatureDetailTab = 'overview' | 'requirements' | 'questions' | 'history';

// Question type (reused from decomposition but defined here for modal context)
export interface FeatureQuestion {
  id: string;
  featureId: string;
  question: string;
  questionType: 'multiple_choice' | 'yes_no' | 'text' | 'dropdown';
  options?: string[];
  impact: 'blocking' | 'clarifying' | 'optional';
  category: 'business' | 'technical' | 'compliance' | 'scope';
  answered: boolean;
  answer?: string;
  answeredAt?: string;
}

export function getAuditActionLabel(action: AuditAction): string {
  const labels: Record<AuditAction, string> = {
    created: 'Feature Created',
    updated: 'Feature Updated',
    question_answered: 'Question Answered',
    readiness_updated: 'Readiness Updated',
    priority_override: 'Priority Override',
    approved: 'Approved',
    loop_started: 'Loop Started',
    loop_completed: 'Loop Completed',
    deployed_staging: 'Deployed to Staging',
    deployed_production: 'Deployed to Production',
    status_changed: 'Status Changed',
  };
  return labels[action] || action;
}

export function getAuditActionIcon(action: AuditAction): string {
  const icons: Record<AuditAction, string> = {
    created: 'plus-circle',
    updated: 'edit',
    question_answered: 'message-circle',
    readiness_updated: 'trending-up',
    priority_override: 'arrow-up-circle',
    approved: 'check-circle',
    loop_started: 'play-circle',
    loop_completed: 'check-circle-2',
    deployed_staging: 'upload',
    deployed_production: 'rocket',
    status_changed: 'refresh-cw',
  };
  return icons[action] || 'circle';
}
