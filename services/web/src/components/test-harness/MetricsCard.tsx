import { Clock, DollarSign, Hash } from 'lucide-react';

export interface Metrics {
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  costUsd: number;
}

interface MetricsCardProps {
  metrics: Metrics | null;
  loading?: boolean;
}

export default function MetricsCard({ metrics, loading }: MetricsCardProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-lg bg-gray-100 p-4">
            <div className="mb-2 h-4 w-16 rounded bg-gray-200" />
            <div className="h-6 w-20 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="grid grid-cols-3 gap-4">
        <MetricBox icon={Clock} label="Latency" value="--" unit="ms" />
        <MetricBox icon={DollarSign} label="Cost" value="--" unit="" />
        <MetricBox icon={Hash} label="Tokens" value="--" unit="" />
      </div>
    );
  }

  const formatCost = (cost: number) => {
    if (cost < 0.0001) return '<$0.0001';
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(3)}`;
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      <MetricBox
        icon={Clock}
        label="Latency"
        value={metrics.latencyMs.toLocaleString()}
        unit="ms"
        color="blue"
      />
      <MetricBox
        icon={DollarSign}
        label="Cost"
        value={formatCost(metrics.costUsd)}
        unit=""
        color="green"
      />
      <MetricBox
        icon={Hash}
        label="Tokens"
        value={metrics.totalTokens.toLocaleString()}
        unit=""
        subtext={`${metrics.tokensIn} in / ${metrics.tokensOut} out`}
        color="purple"
      />
    </div>
  );
}

interface MetricBoxProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unit: string;
  subtext?: string;
  color?: 'blue' | 'green' | 'purple';
}

function MetricBox({ icon: Icon, label, value, unit, subtext, color = 'blue' }: MetricBoxProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <div className={`rounded-lg p-1.5 ${colorClasses[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-gray-400">{unit}</span>}
      </p>
      {subtext && <p className="mt-1 text-xs text-gray-400">{subtext}</p>}
    </div>
  );
}
