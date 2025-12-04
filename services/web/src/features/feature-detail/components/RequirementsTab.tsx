import clsx from 'clsx';
import { Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { FeatureRequirement } from '../types';

interface RequirementsTabProps {
  requirements: FeatureRequirement[];
  isLoading?: boolean;
}

function getClarityColor(clarity: number): string {
  if (clarity >= 0.8) return 'text-green-600 dark:text-green-400';
  if (clarity >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function getClarityBgColor(clarity: number): string {
  if (clarity >= 0.8) return 'bg-green-100 dark:bg-green-900/30';
  if (clarity >= 0.6) return 'bg-yellow-100 dark:bg-yellow-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
}

export function RequirementsTab({ requirements, isLoading }: RequirementsTabProps) {
  const [expandedId, setExpandedId] = useState<string | undefined>();

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    );
  }

  if (requirements.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">No requirements found.</p>
      </div>
    );
  }

  // Group by theme
  const groupedByTheme = requirements.reduce(
    (acc, req) => {
      const themeName = req.themeName || 'Uncategorized';
      if (!acc[themeName]) {
        acc[themeName] = [];
      }
      acc[themeName].push(req);
      return acc;
    },
    {} as Record<string, FeatureRequirement[]>
  );

  return (
    <div className="space-y-4 p-4">
      {Object.entries(groupedByTheme).map(([themeName, reqs]) => (
        <div key={themeName}>
          <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">{themeName}</h4>
          <div className="space-y-2">
            {reqs.map((req) => (
              <RequirementItem
                key={req.id}
                requirement={req}
                isExpanded={expandedId === req.id}
                onToggle={() => setExpandedId(expandedId === req.id ? undefined : req.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface RequirementItemProps {
  requirement: FeatureRequirement;
  isExpanded: boolean;
  onToggle: () => void;
}

function RequirementItem({ requirement, isExpanded, onToggle }: RequirementItemProps) {
  const hasAcceptanceCriteria =
    requirement.acceptanceCriteria && requirement.acceptanceCriteria.length > 0;
  const clarityPercent = Math.round(requirement.clarity * 100);

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div
        onClick={hasAcceptanceCriteria ? onToggle : undefined}
        className={clsx(
          'flex items-start gap-3 p-3',
          hasAcceptanceCriteria && 'dark:hover:bg-gray-750 cursor-pointer hover:bg-gray-50'
        )}
      >
        {/* AR ID */}
        <span className="flex-shrink-0 font-mono text-xs text-gray-400 dark:text-gray-500">
          {requirement.id.toUpperCase()}
        </span>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-900 dark:text-white">{requirement.text}</p>
        </div>

        {/* Clarity Badge */}
        <div
          className={clsx(
            'flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
            getClarityBgColor(requirement.clarity),
            getClarityColor(requirement.clarity)
          )}
        >
          {clarityPercent}%
        </div>

        {/* Testability */}
        <div className="flex-shrink-0" title={requirement.testable ? 'Testable' : 'Not testable'}>
          {requirement.testable ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <X className="h-4 w-4 text-red-500" />
          )}
        </div>

        {/* Expand Icon */}
        {hasAcceptanceCriteria && (
          <div className="flex-shrink-0">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </div>
        )}
      </div>

      {/* Acceptance Criteria (expanded) */}
      {isExpanded && hasAcceptanceCriteria && (
        <div className="dark:bg-gray-750 border-t border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700">
          <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
            Acceptance Criteria:
          </p>
          <ul className="space-y-1">
            {requirement.acceptanceCriteria!.map((criterion, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400"
              >
                <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-gray-400 dark:bg-gray-500" />
                {criterion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
