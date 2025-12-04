import clsx from 'clsx';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useMemo } from 'react';
import type { FeatureCandidate, Theme } from '../types';
import { FeatureRow } from './FeatureRow';
import { Button } from '@/components/ui';

interface FeaturesSectionProps {
  features: FeatureCandidate[];
  themes: Theme[];
  selectedThemeId?: string;
  onFeatureClick: (featureId: string) => void;
  initialShowCount?: number;
  className?: string;
}

export function FeaturesSection({
  features,
  themes,
  selectedThemeId,
  onFeatureClick,
  initialShowCount = 5,
  className,
}: FeaturesSectionProps) {
  const [showAll, setShowAll] = useState(false);

  // Filter features by selected theme
  const filteredFeatures = useMemo(() => {
    if (!selectedThemeId) return features;
    const theme = themes.find((t) => t.id === selectedThemeId);
    if (!theme) return features;
    return features.filter((f) => theme.relatedFeatures.includes(f.id));
  }, [features, themes, selectedThemeId]);

  // Sort by priority score
  const sortedFeatures = useMemo(() => {
    return [...filteredFeatures].sort((a, b) => b.suggestedPriority - a.suggestedPriority);
  }, [filteredFeatures]);

  const displayedFeatures = showAll ? sortedFeatures : sortedFeatures.slice(0, initialShowCount);
  const hasMore = sortedFeatures.length > initialShowCount;

  return (
    <div className={clsx('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Features ({filteredFeatures.length})
        </h3>
      </div>

      <div className="space-y-2">
        {displayedFeatures.map((feature) => (
          <FeatureRow
            key={feature.id}
            feature={feature}
            onClick={() => onFeatureClick(feature.id)}
          />
        ))}

        {filteredFeatures.length === 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center dark:border-gray-700 dark:bg-gray-800/50">
            <p className="text-gray-500 dark:text-gray-400">No features found for this theme.</p>
          </div>
        )}
      </div>

      {hasMore && (
        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            rightIcon={
              showAll ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
            }
          >
            {showAll ? 'Show less' : `Show ${sortedFeatures.length - initialShowCount} more`}
          </Button>
        </div>
      )}
    </div>
  );
}
