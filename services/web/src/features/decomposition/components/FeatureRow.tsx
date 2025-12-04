import clsx from 'clsx';
import { ChevronRight, MessageSquare } from 'lucide-react';
import { getReadinessColor, getComplexityLabel, type FeatureCandidate } from '../types';

interface FeatureRowProps {
  feature: FeatureCandidate;
  onClick: () => void;
}

export function FeatureRow({ feature, onClick }: FeatureRowProps) {
  const complexity = getComplexityLabel(feature.estimatedComplexity);
  const readinessPercent = Math.round(feature.readinessScore * 100);
  const hasQuestions = feature.pendingQuestions > 0;

  return (
    <div
      onClick={onClick}
      className={clsx(
        'flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-all',
        'cursor-pointer hover:border-primary-300 hover:shadow-md',
        'dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-600'
      )}
    >
      {/* Feature ID */}
      <div className="flex-shrink-0">
        <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
          {feature.id.toUpperCase()}
        </span>
      </div>

      {/* Title & Description */}
      <div className="min-w-0 flex-1">
        <h4 className="truncate font-medium text-gray-900 dark:text-white">{feature.title}</h4>
        {feature.description && (
          <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
            {feature.description}
          </p>
        )}
      </div>

      {/* Readiness Bar */}
      <div className="flex w-24 flex-shrink-0 items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={clsx('h-full rounded-full transition-all', getReadinessColor(feature.readinessScore))}
            style={{ width: `${readinessPercent}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
          {readinessPercent}%
        </span>
      </div>

      {/* Complexity Badge */}
      <div className="flex-shrink-0">
        <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', complexity.color)}>
          {complexity.label}
        </span>
      </div>

      {/* Questions Badge */}
      {hasQuestions && (
        <div className="flex flex-shrink-0 items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400">
          <MessageSquare className="h-3 w-3" />
          {feature.pendingQuestions}
        </div>
      )}

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
    </div>
  );
}
