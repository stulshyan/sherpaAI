import clsx from 'clsx';
import { AlertCircle, RefreshCw, Bot } from 'lucide-react';
import type { DecompositionStatus } from '../types';
import { AIThinkingAnimation } from './AIThinkingAnimation';
import { ProgressStages } from './ProgressStages';
import { Button } from '@/components/ui';

interface ProcessingProgressProps {
  status: DecompositionStatus;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function ProcessingProgress({ status, onRetry, isRetrying }: ProcessingProgressProps) {
  const isFailed = status.status === 'failed';

  if (isFailed) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-900/20">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
        <h3 className="mb-2 text-lg font-semibold text-red-700 dark:text-red-400">
          Processing Failed
        </h3>
        <p className="mb-6 text-red-600 dark:text-red-300">
          {status.errorMessage || 'An error occurred while processing your requirements.'}
        </p>
        {onRetry && (
          <Button
            variant="danger"
            onClick={onRetry}
            loading={isRetrying}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Retry Processing
          </Button>
        )}
      </div>
    );
  }

  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds || seconds <= 0) return null;
    if (seconds < 60) return `~${Math.ceil(seconds)} seconds`;
    return `~${Math.ceil(seconds / 60)} minute${seconds >= 120 ? 's' : ''}`;
  };

  const timeRemaining = formatTimeRemaining(status.estimatedTimeRemaining);

  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50 p-8 dark:border-primary-800 dark:bg-primary-900/20">
      <div className="mb-6 text-center">
        <div className="mb-4 inline-flex items-center justify-center rounded-full bg-primary-100 p-4 dark:bg-primary-800/50">
          <Bot className="h-8 w-8 text-primary-600 dark:text-primary-400" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          AI is analyzing your requirements
        </h3>
        <AIThinkingAnimation size="lg" className="mb-4" />
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">{status.currentStage}</span>
          <span className="font-medium text-primary-600 dark:text-primary-400">
            {status.progress}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-500 ease-out',
              'bg-primary-500 dark:bg-primary-400'
            )}
            style={{ width: `${status.progress}%` }}
          />
        </div>
        {timeRemaining && (
          <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
            Estimated time remaining: {timeRemaining}
          </p>
        )}
      </div>

      {/* Stage Checklist */}
      <div className="rounded-lg bg-white/50 p-4 dark:bg-gray-800/50">
        <ProgressStages currentStage={status.status} />
      </div>
    </div>
  );
}
