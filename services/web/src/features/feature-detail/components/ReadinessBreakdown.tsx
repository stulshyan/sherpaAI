import clsx from 'clsx';

interface ReadinessBreakdownProps {
  score: number;
  breakdown: {
    businessClarity: number;
    technicalClarity: number;
    testability: number;
    completeness: number;
  };
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 0.8) return 'bg-green-500';
  if (score >= 0.6) return 'bg-yellow-500';
  return 'bg-gray-400';
}

function getScoreLabel(score: number): string {
  if (score >= 0.8) return 'Good';
  if (score >= 0.6) return 'Fair';
  return 'Needs work';
}

export function ReadinessBreakdown({ score, breakdown, className }: ReadinessBreakdownProps) {
  const items = [
    { label: 'Business Clarity', value: breakdown.businessClarity },
    { label: 'Technical Clarity', value: breakdown.technicalClarity },
    { label: 'Testability', value: breakdown.testability },
    { label: 'Completeness', value: breakdown.completeness },
  ];

  const overallPercent = Math.round(score * 100);

  return (
    <div
      className={clsx(
        'rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50',
        className
      )}
    >
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Readiness Score</h4>
          <span
            className={clsx(
              'text-lg font-bold',
              score >= 0.8
                ? 'text-green-600 dark:text-green-400'
                : score >= 0.6
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-gray-600 dark:text-gray-400'
            )}
          >
            {overallPercent}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={clsx('h-full rounded-full transition-all', getScoreColor(score))}
            style={{ width: `${overallPercent}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{getScoreLabel(score)}</p>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const percent = Math.round(item.value * 100);
          return (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">{percent}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className={clsx('h-full rounded-full transition-all', getScoreColor(item.value))}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
