import clsx from 'clsx';
import type { Theme } from '../types';

interface ThemeCardProps {
  theme: Theme;
  isSelected?: boolean;
  onClick?: () => void;
}

// Theme domain icons
const domainIcons: Record<string, string> = {
  Security: '🔐',
  Commerce: '🛒',
  Finance: '💳',
  Analytics: '📊',
  Communication: '📬',
  'User Management': '👤',
  Integration: '🔗',
  UI: '🎨',
  Data: '📁',
  Mobile: '📱',
  Search: '🔍',
  default: '📦',
};

function getDomainIcon(domain: string): string {
  return domainIcons[domain] || domainIcons.default;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.85) return 'text-green-600 dark:text-green-400';
  if (confidence >= 0.7) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-gray-600 dark:text-gray-400';
}

export function ThemeCard({ theme, isSelected, onClick }: ThemeCardProps) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'cursor-pointer rounded-lg border p-4 transition-all',
        'hover:shadow-md',
        isSelected
          ? 'border-primary-500 bg-primary-50 ring-primary-200 dark:border-primary-400 dark:bg-primary-900/30 dark:ring-primary-800 ring-2'
          : 'hover:border-primary-300 dark:hover:border-primary-600 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
      )}
    >
      {/* Icon */}
      <div className="mb-2 text-2xl">{getDomainIcon(theme.domain)}</div>

      {/* Label */}
      <h4 className="mb-1 font-medium text-gray-900 dark:text-white">{theme.label}</h4>

      {/* Domain */}
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{theme.domain}</p>

      {/* Confidence */}
      <div className="flex items-center gap-1">
        <span className={clsx('text-sm font-medium', getConfidenceColor(theme.confidence))}>
          {theme.confidence.toFixed(2)}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">confidence</span>
      </div>

      {/* Feature count */}
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {theme.relatedFeatures.length} feature{theme.relatedFeatures.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
