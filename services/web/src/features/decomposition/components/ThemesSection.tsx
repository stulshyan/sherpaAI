import clsx from 'clsx';
import { X } from 'lucide-react';
import type { Theme } from '../types';
import { ThemeCard } from './ThemeCard';
import { Button } from '@/components/ui';

interface ThemesSectionProps {
  themes: Theme[];
  selectedThemeId?: string;
  onSelectTheme: (themeId: string | undefined) => void;
  className?: string;
}

export function ThemesSection({
  themes,
  selectedThemeId,
  onSelectTheme,
  className,
}: ThemesSectionProps) {
  const selectedTheme = themes.find((t) => t.id === selectedThemeId);

  return (
    <div className={clsx('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Themes</h3>
        {selectedTheme && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Showing features for:{' '}
              <span className="text-primary-600 dark:text-primary-400 font-medium">
                {selectedTheme.label}
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSelectTheme(undefined)}
              leftIcon={<X className="h-3 w-3" />}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {themes.map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            isSelected={theme.id === selectedThemeId}
            onClick={() => onSelectTheme(theme.id === selectedThemeId ? undefined : theme.id)}
          />
        ))}
      </div>
    </div>
  );
}
