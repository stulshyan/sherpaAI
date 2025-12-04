import clsx from 'clsx';
import { Link as LinkIcon, AlertTriangle } from 'lucide-react';
import type { FeatureDetail, FeatureDependency } from '../types';
import { getStatusLabel, getStatusColor, getComplexityLabel } from './helpers';
import { PriorityFactors } from './PriorityFactors';
import { ReadinessBreakdown } from './ReadinessBreakdown';

interface OverviewTabProps {
  feature: FeatureDetail;
}

export function OverviewTab({ feature }: OverviewTabProps) {
  const complexity = getComplexityLabel(feature.estimatedComplexity);
  const hasBlockers = feature.blockedBy.length > 0;

  return (
    <div className="space-y-6 p-4">
      {/* Description */}
      <div>
        <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Description</h4>
        <p className="text-gray-600 dark:text-gray-400">
          {feature.description || 'No description provided.'}
        </p>
      </div>

      {/* Scores Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ReadinessBreakdown score={feature.readinessScore} breakdown={feature.readinessBreakdown} />
        <PriorityFactors score={feature.priorityScore} factors={feature.priorityFactors} />
      </div>

      {/* Status & Complexity */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Status
          </h4>
          <span
            className={clsx(
              'inline-block rounded-full px-2.5 py-1 text-xs font-medium',
              getStatusColor(feature.status)
            )}
          >
            {getStatusLabel(feature.status)}
          </span>
        </div>

        <div>
          <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Complexity
          </h4>
          <span
            className={clsx(
              'inline-block rounded-full px-2.5 py-1 text-xs font-medium',
              complexity.color
            )}
          >
            {complexity.label}
          </span>
        </div>

        <div>
          <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Requirements
          </h4>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {feature.requirementCount}
          </span>
        </div>

        <div>
          <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Questions
          </h4>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {feature.questionCount}
            {feature.blockingQuestionCount > 0 && (
              <span className="ml-1 text-xs text-red-600 dark:text-red-400">
                ({feature.blockingQuestionCount} blocking)
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Blockers Warning */}
      {hasBlockers && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="mb-2 flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Blocked by {feature.blockedBy.length} feature(s)</span>
          </div>
          <div className="space-y-1">
            {feature.blockedBy.map((id) => (
              <div
                key={id}
                className="flex items-center gap-2 text-sm text-red-600 dark:text-red-300"
              >
                <LinkIcon className="h-3 w-3" />
                {id.toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dependencies */}
      {feature.dependencies.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Dependencies
          </h4>
          <div className="space-y-2">
            {feature.dependencies.map((dep) => (
              <DependencyItem key={dep.featureId} dependency={dep} />
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {feature.tags.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Tags</h4>
          <div className="flex flex-wrap gap-2">
            {feature.tags.map((tag) => (
              <span
                key={tag}
                className="bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 rounded-full px-2.5 py-1 text-xs font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DependencyItem({ dependency }: { dependency: FeatureDependency }) {
  const statusColor = getStatusColor(dependency.status);

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-2">
        <LinkIcon className="h-4 w-4 text-gray-400" />
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
          {dependency.featureId.toUpperCase()}
        </span>
        <span className="text-sm text-gray-900 dark:text-white">{dependency.featureTitle}</span>
      </div>
      <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', statusColor)}>
        {getStatusLabel(dependency.status)}
      </span>
    </div>
  );
}
