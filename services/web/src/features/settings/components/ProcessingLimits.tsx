import type { ProcessingLimitsData } from '../types';
import { SettingsSection } from './SettingsSection';

interface ProcessingLimitsProps {
  limits: ProcessingLimitsData;
  className?: string;
}

export function ProcessingLimits({ limits, className }: ProcessingLimitsProps) {
  const formatQuota = (quota: number | 'unlimited') => {
    if (quota === 'unlimited') {
      return 'Unlimited (Enterprise)';
    }
    return quota.toLocaleString();
  };

  return (
    <SettingsSection
      title="Processing Limits"
      description="Resource limits for your project"
      className={className}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* WIP Limit */}
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <span className="block text-sm font-medium text-gray-500">WIP Limit</span>
          <span className="mt-1 block text-lg font-semibold text-gray-900">
            {limits.wipLimit} features in parallel
          </span>
        </div>

        {/* Max Upload Size */}
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <span className="block text-sm font-medium text-gray-500">Max Upload Size</span>
          <span className="mt-1 block text-lg font-semibold text-gray-900">
            {limits.maxUploadSizeMb} MB
          </span>
        </div>

        {/* Daily Quota */}
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <span className="block text-sm font-medium text-gray-500">Daily Quota</span>
          <span className="mt-1 block text-lg font-semibold text-gray-900">
            {formatQuota(limits.dailyQuota)}
          </span>
        </div>

        {/* Concurrent Agents */}
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <span className="block text-sm font-medium text-gray-500">Concurrent Agents</span>
          <span className="mt-1 block text-lg font-semibold text-gray-900">
            {limits.concurrentAgents}
          </span>
        </div>
      </div>
    </SettingsSection>
  );
}
