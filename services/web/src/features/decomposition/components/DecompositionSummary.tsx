import clsx from 'clsx';
import { Layers, Package, FileText, HelpCircle, AlertTriangle, Star, BarChart3 } from 'lucide-react';
import type { DecompositionSummary as DecompositionSummaryType } from '../types';

interface DecompositionSummaryCardProps {
  summary: DecompositionSummaryType;
  onRecommendedClick?: () => void;
  className?: string;
}

export function DecompositionSummaryCard({
  summary,
  onRecommendedClick,
  className,
}: DecompositionSummaryCardProps) {
  const stats = [
    {
      icon: Layers,
      label: 'Themes',
      value: summary.totalThemes,
      color: 'text-blue-500',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      icon: Package,
      label: 'Features',
      value: summary.totalFeatures,
      color: 'text-green-500',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      icon: FileText,
      label: 'Requirements',
      value: summary.totalAtomicRequirements,
      color: 'text-purple-500',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    },
    {
      icon: HelpCircle,
      label: 'Questions',
      value: summary.totalQuestions,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    },
  ];

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="mb-2 flex items-center gap-2">
              <div className={clsx('rounded-lg p-2', stat.bgColor)}>
                <stat.icon className={clsx('h-4 w-4', stat.color)} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Additional Info */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Blocking Questions */}
        {summary.blockingQuestions > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                {summary.blockingQuestions} Blocking
              </p>
              <p className="text-xs text-red-600 dark:text-red-300">Questions must be answered</p>
            </div>
          </div>
        )}

        {/* Average Clarity */}
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
          <BarChart3 className="h-5 w-5 text-gray-500" />
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {(summary.averageClarity * 100).toFixed(0)}% Avg Clarity
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Requirements quality</p>
          </div>
        </div>

        {/* Recommended Feature */}
        {summary.recommendedFirstFeature && (
          <button
            onClick={onRecommendedClick}
            className="flex items-center gap-3 rounded-lg border border-primary-200 bg-primary-50 p-3 text-left transition-all hover:border-primary-300 hover:shadow-sm dark:border-primary-800 dark:bg-primary-900/20 dark:hover:border-primary-700"
          >
            <Star className="h-5 w-5 text-primary-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-primary-700 dark:text-primary-400">
                Recommended
              </p>
              <p className="truncate text-xs text-primary-600 dark:text-primary-300">
                {summary.recommendedFirstFeature.id.toUpperCase()}: {summary.recommendedFirstFeature.title}
              </p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
