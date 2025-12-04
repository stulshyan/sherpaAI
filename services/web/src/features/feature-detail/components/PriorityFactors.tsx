import clsx from 'clsx';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PriorityFactorsProps {
  score: number;
  factors: {
    businessValue: number;
    urgency: number;
    complexity: number;
    readiness: number;
    dependencies: number;
  };
  className?: string;
}

function getFactorLabel(value: number): { label: string; color: string; Icon: typeof TrendingUp } {
  if (value >= 0.7) return { label: 'High', color: 'text-green-600 dark:text-green-400', Icon: TrendingUp };
  if (value >= 0.4) return { label: 'Medium', color: 'text-yellow-600 dark:text-yellow-400', Icon: Minus };
  if (value >= 0) return { label: 'Low', color: 'text-gray-500 dark:text-gray-400', Icon: TrendingDown };
  // Negative values (penalties)
  return { label: 'Penalty', color: 'text-red-600 dark:text-red-400', Icon: TrendingDown };
}

export function PriorityFactors({ score, factors, className }: PriorityFactorsProps) {
  const items = [
    { label: 'Business Value', value: factors.businessValue },
    { label: 'Urgency', value: factors.urgency },
    { label: 'Complexity', value: factors.complexity, invert: true },
    { label: 'Readiness', value: factors.readiness },
    { label: 'Dependencies', value: factors.dependencies, invert: true },
  ];

  return (
    <div className={clsx('rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Priority Score</h4>
        <span className="text-lg font-bold text-gray-900 dark:text-white">{score.toFixed(2)}</span>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const displayValue = item.invert ? Math.abs(item.value) : item.value;
          const factorInfo = getFactorLabel(displayValue);
          const FactorIcon = factorInfo.Icon;

          return (
            <div key={item.label} className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
              <div className="flex items-center gap-1">
                <FactorIcon className={clsx('h-3 w-3', factorInfo.color)} />
                <span className={clsx('font-medium', factorInfo.color)}>
                  {factorInfo.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
