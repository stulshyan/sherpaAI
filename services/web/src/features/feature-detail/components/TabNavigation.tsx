import clsx from 'clsx';
import type { FeatureDetailTab } from '../types';

interface TabNavigationProps {
  activeTab: FeatureDetailTab;
  onTabChange: (tab: FeatureDetailTab) => void;
  requirementCount: number;
  questionCount: number;
  className?: string;
}

export function TabNavigation({
  activeTab,
  onTabChange,
  requirementCount,
  questionCount,
  className,
}: TabNavigationProps) {
  const tabs: Array<{ id: FeatureDetailTab; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'requirements', label: 'Requirements', count: requirementCount },
    { id: 'questions', label: 'Questions', count: questionCount },
    { id: 'history', label: 'History' },
  ];

  return (
    <div className={clsx('border-b border-gray-200 dark:border-gray-700', className)}>
      <nav className="-mb-px flex overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={clsx(
              'flex-shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-primary-500 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300'
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={clsx(
                  'ml-2 rounded-full px-2 py-0.5 text-xs',
                  activeTab === tab.id
                    ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
