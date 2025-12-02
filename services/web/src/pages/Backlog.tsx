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
      <h1 className="text-2xl font-bold mb-6">Feature Backlog</h1>

      <div className="grid grid-cols-4 gap-4">
        {columns.map((column) => (
          <div key={column.id} className="bg-gray-100 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className={clsx('w-3 h-3 rounded-full', column.color)} />
              <h2 className="font-semibold">{column.label}</h2>
              <span className="text-sm text-gray-500">
                ({features[column.id]?.length || 0})
              </span>
            </div>

            <div className="space-y-2">
              {features[column.id]?.map((feature) => (
                <div
                  key={feature.id}
                  className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <h3 className="font-medium mb-2">{feature.title}</h3>
                  <div className="flex items-center gap-2">
                    <PriorityBadge score={feature.priorityScore} />
                    <ReadinessIndicator score={feature.readinessScore} />
                  </div>
                </div>
              ))}

              {(!features[column.id] || features[column.id].length === 0) && (
                <p className="text-sm text-gray-500 text-center py-8">
                  No features
                </p>
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

  return (
    <span className={clsx('text-xs px-2 py-1 rounded', color)}>{label}</span>
  );
}

function ReadinessIndicator({ score }: { score: number }) {
  const percentage = Math.round(score * 100);

  return (
    <div className="flex items-center gap-1">
      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-entropy-500 rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-gray-500">{percentage}%</span>
    </div>
  );
}
