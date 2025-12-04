import clsx from 'clsx';
import { Check, Circle, Loader2 } from 'lucide-react';
import { PROCESSING_STAGES, getStageIndex, type DecompositionStage } from '../types';

interface ProgressStagesProps {
  currentStage: DecompositionStage;
  className?: string;
}

export function ProgressStages({ currentStage, className }: ProgressStagesProps) {
  const currentIndex = getStageIndex(currentStage);

  return (
    <div className={clsx('space-y-2', className)}>
      {PROCESSING_STAGES.map((stage, index) => {
        const isCompleted = index < currentIndex || currentStage === 'completed';
        const isCurrent = index === currentIndex && currentStage !== 'completed';
        const isPending = index > currentIndex;

        return (
          <div
            key={stage.key}
            className={clsx(
              'flex items-center gap-3 text-sm transition-all duration-300',
              isCompleted && 'text-green-600 dark:text-green-400',
              isCurrent && 'text-primary-600 dark:text-primary-400 font-medium',
              isPending && 'text-gray-400 dark:text-gray-500'
            )}
          >
            <div className="flex-shrink-0">
              {isCompleted ? (
                <Check className="h-4 w-4" />
              ) : isCurrent ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </div>
            <span>{stage.label}</span>
          </div>
        );
      })}
    </div>
  );
}
