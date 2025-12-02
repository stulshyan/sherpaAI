import clsx from 'clsx';
import { useState } from 'react';

const columns = [
  { id: 'now-playing', label: 'Now Playing', color: 'bg-blue-500' },
  { id: 'ready-soon', label: 'Ready Soon', color: 'bg-green-500' },
  { id: 'needs-attention', label: 'Needs Attention', color: 'bg-yellow-500' },
  { id: 'waiting', label: 'Waiting', color: 'bg-gray-400' },
];

export default function Backlog() {
  const [features] = useState<Record<string, FeatureCard[]>>({
    'now-playing': [],
    'ready-soon': [],
    'needs-attention': [],
    waiting: [],
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Feature Backlog</h1>

      <div className="grid grid-cols-4 gap-4">
        {columns.map((column) => (
          <div key={column.id} className="rounded-lg bg-gray-100 p-4">
            <div className="mb-4 flex items-center gap-2">
              <div className={clsx('h-3 w-3 rounded-full', column.color)} />
              <h2 className="font-semibold">{column.label}</h2>
              <span className="text-sm text-gray-500">({features[column.id]?.length || 0})</span>
            </div>

            <div className="space-y-2">
              {features[column.id]?.map((feature) => (
                <div
                  key={feature.id}
                  className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
                >
                  <h3 className="mb-2 font-medium">{feature.title}</h3>
                  <div className="flex items-center gap-2">
                    <PriorityBadge score={feature.priorityScore} />
                    <ReadinessIndicator score={feature.readinessScore} />
                  </div>
                </div>
              ))}

              {(!features[column.id] || features[column.id].length === 0) && (
                <p className="py-8 text-center text-sm text-gray-500">No features</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface FeatureCard {
  id: string;
  title: string;
  priorityScore: number;
  readinessScore: number;
}

function PriorityBadge({ score }: { score: number }) {
  const label = score >= 0.7 ? 'High' : score >= 0.4 ? 'Medium' : 'Low';
  const color =
    score >= 0.7
      ? 'bg-red-100 text-red-700'
      : score >= 0.4
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-gray-100 text-gray-700';

  return <span className={clsx('rounded px-2 py-1 text-xs', color)}>{label}</span>;
}

function ReadinessIndicator({ score }: { score: number }) {
  const percentage = Math.round(score * 100);

  return (
    <div className="flex items-center gap-1">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200">
        <div className="bg-entropy-500 h-full rounded-full" style={{ width: `${percentage}%` }} />
      </div>
      <span className="text-xs text-gray-500">{percentage}%</span>
    </div>
  );
}
