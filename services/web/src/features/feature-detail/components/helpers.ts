import type { FeatureDetailStatus } from '../types';

export function getStatusLabel(status: FeatureDetailStatus): string {
  const labels: Record<FeatureDetailStatus, string> = {
    backlog: 'Backlog',
    approved: 'Approved',
    in_loop_a: 'Loop A',
    in_loop_b: 'Loop B',
    in_loop_c: 'Loop C',
    blocked: 'Blocked',
    needs_clarification: 'Needs Clarification',
    deferred: 'Deferred',
    deployed_staging: 'Staging',
    deployed_production: 'Production',
  };
  return labels[status] || status;
}

export function getStatusColor(status: FeatureDetailStatus): string {
  const colors: Record<FeatureDetailStatus, string> = {
    backlog: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    in_loop_a: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    in_loop_b: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    in_loop_c: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    blocked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    needs_clarification: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    deferred: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    deployed_staging: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    deployed_production: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };
  return colors[status] || colors.backlog;
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

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
