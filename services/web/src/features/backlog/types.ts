// Feature Backlog Types

export interface Feature {
  id: string;
  title: string;
  description?: string;
  status: FeatureStatus;
  priorityScore: number;
  readinessScore: number;
  currentLoop?: 'A' | 'B' | 'C';
  loopProgress?: number; // 0-100
  pendingQuestions: number;
  blockedBy?: string[]; // Feature IDs
  themes?: string[];
  acceptanceCriteria?: string[];
  requirementId?: string;
  createdAt: string;
  updatedAt: string;
  projectId: string;
}

export type FeatureStatus =
  | 'backlog'
  | 'in_loop_a'
  | 'in_loop_b'
  | 'in_loop_c'
  | 'blocked'
  | 'needs_clarification'
  | 'deferred'
  | 'deployed_staging'
  | 'deployed_production';

export interface BacklogView {
  name: string;
  count: number;
  items: Feature[];
}

export interface BacklogSummary {
  nowPlaying: BacklogView;
  readySoon: BacklogView;
  needsAttention: BacklogView;
  waiting: BacklogView;
  totalFeatures: number;
}

export interface BacklogFilters {
  search?: string;
  status?: FeatureStatus;
  minReadiness?: number;
}

// Column configuration
export const BACKLOG_COLUMNS = [
  {
    id: 'now-playing',
    key: 'nowPlaying' as const,
    title: 'Now Playing',
    icon: '▶️',
    color: 'border-green-500',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    emptyMessage: 'No features in active loops',
  },
  {
    id: 'ready-soon',
    key: 'readySoon' as const,
    title: 'Ready Soon',
    icon: '🟢',
    color: 'border-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    emptyMessage: 'No features ready to start',
  },
  {
    id: 'needs-attention',
    key: 'needsAttention' as const,
    title: 'Needs Attention',
    icon: '⚠️',
    color: 'border-yellow-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    emptyMessage: 'All clear! No blockers.',
  },
  {
    id: 'waiting',
    key: 'waiting' as const,
    title: 'Waiting',
    icon: '⏳',
    color: 'border-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-800/50',
    emptyMessage: 'No features waiting',
  },
];

// Priority color helper
export function getPriorityColor(score: number): string {
  if (score >= 0.8) return 'bg-red-500';
  if (score >= 0.6) return 'bg-yellow-500';
  if (score >= 0.4) return 'bg-blue-500';
  return 'bg-gray-400';
}

export function getPriorityLabel(score: number): string {
  if (score >= 0.8) return 'High';
  if (score >= 0.6) return 'Medium';
  if (score >= 0.4) return 'Low';
  return 'Very Low';
}
