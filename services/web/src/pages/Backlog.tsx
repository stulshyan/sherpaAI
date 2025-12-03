import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import clsx from 'clsx';
import { RefreshCw, MessageSquare, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const api = axios.create({
  baseURL: '/api/v1',
});

interface Clarification {
  id: string;
  question: string;
  status: 'pending' | 'answered';
  answer?: string;
  createdAt: string;
  answeredAt?: string;
}

interface Feature {
  id: string;
  requirementId: string;
  title: string;
  description: string;
  status: string;
  readinessScore: number;
  priorityScore: number;
  clarifications?: Clarification[];
  themes?: string[];
  acceptanceCriteria?: string[];
  createdAt: string;
  updatedAt: string;
}

interface FeaturesResponse {
  data: Feature[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

const columns = [
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-500', statuses: ['in_progress'] },
  { id: 'ready', label: 'Ready', color: 'bg-green-500', statuses: ['ready'] },
  {
    id: 'needs-attention',
    label: 'Needs Attention',
    color: 'bg-yellow-500',
    statuses: ['needs_attention'],
  },
  { id: 'pending', label: 'Pending', color: 'bg-gray-400', statuses: ['pending'] },
];

export default function Backlog() {
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const queryClient = useQueryClient();

  // Fetch all features
  const {
    data: featuresData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<FeaturesResponse>({
    queryKey: ['features'],
    queryFn: async () => {
      const response = await api.get('/features');
      return response.data;
    },
  });

  // Update feature status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ featureId, status }: { featureId: string; status: string }) => {
      const response = await api.patch(`/features/${featureId}/status`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['features'] });
      queryClient.invalidateQueries({ queryKey: ['feature-stats'] });
    },
  });

  const features = featuresData?.data || [];

  // Group features by column
  const groupedFeatures: Record<string, Feature[]> = {
    in_progress: [],
    ready: [],
    'needs-attention': [],
    pending: [],
  };

  features.forEach((feature) => {
    // Check if feature needs attention (has pending clarifications)
    const needsAttention = feature.clarifications?.some((c) => c.status === 'pending') ?? false;

    if (needsAttention) {
      groupedFeatures['needs-attention'].push(feature);
    } else if (feature.status === 'in_progress') {
      groupedFeatures['in_progress'].push(feature);
    } else if (feature.status === 'ready') {
      groupedFeatures['ready'].push(feature);
    } else {
      groupedFeatures['pending'].push(feature);
    }
  });

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="mb-2 text-lg font-semibold text-red-700">Failed to load backlog</h2>
        <p className="text-red-600">{error instanceof Error ? error.message : 'Unknown error'}</p>
        <button
          onClick={() => refetch()}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-6">
      {/* Main Kanban Board */}
      <div className="flex-1">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Feature Backlog</h1>
            <p className="text-gray-500">{features.length} features • Drag to change status</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className={clsx(
              'flex items-center gap-2 rounded-lg px-4 py-2 transition-colors',
              isFetching
                ? 'bg-gray-100 text-gray-400'
                : 'bg-entropy-600 hover:bg-entropy-700 text-white'
            )}
          >
            <RefreshCw className={clsx('h-4 w-4', isFetching && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-4 gap-4">
            {columns.map((column) => (
              <div key={column.id} className="animate-pulse rounded-lg bg-gray-100 p-4">
                <div className="mb-4 h-6 w-24 rounded bg-gray-200" />
                <div className="space-y-2">
                  <div className="h-24 rounded-lg bg-gray-200" />
                  <div className="h-24 rounded-lg bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {columns.map((column) => (
              <div key={column.id} className="rounded-lg bg-gray-100 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <div className={clsx('h-3 w-3 rounded-full', column.color)} />
                  <h2 className="font-semibold">{column.label}</h2>
                  <span className="text-sm text-gray-500">
                    ({groupedFeatures[column.id]?.length || 0})
                  </span>
                </div>

                <div className="space-y-2">
                  {groupedFeatures[column.id]?.map((feature) => (
                    <FeatureCard
                      key={feature.id}
                      feature={feature}
                      onClick={() => setSelectedFeature(feature)}
                      isSelected={selectedFeature?.id === feature.id}
                    />
                  ))}

                  {(!groupedFeatures[column.id] || groupedFeatures[column.id].length === 0) && (
                    <p className="py-8 text-center text-sm text-gray-500">No features</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedFeature && (
        <FeatureDetailPanel
          feature={selectedFeature}
          onClose={() => setSelectedFeature(null)}
          onStatusChange={(status) => {
            updateStatusMutation.mutate({
              featureId: selectedFeature.id,
              status,
            });
          }}
        />
      )}
    </div>
  );
}

interface FeatureCardProps {
  feature: Feature;
  onClick: () => void;
  isSelected: boolean;
}

function FeatureCard({ feature, onClick, isSelected }: FeatureCardProps) {
  const pendingClarifications =
    feature.clarifications?.filter((c) => c.status === 'pending').length || 0;

  return (
    <div
      onClick={onClick}
      className={clsx(
        'cursor-pointer rounded-lg border bg-white p-4 transition-all',
        isSelected
          ? 'border-entropy-500 ring-entropy-200 ring-2'
          : 'border-gray-200 hover:shadow-md'
      )}
    >
      <h3 className="mb-2 font-medium">{feature.title}</h3>
      <p className="mb-3 line-clamp-2 text-sm text-gray-500">{feature.description}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PriorityBadge score={feature.priorityScore} />
          <ReadinessIndicator score={feature.readinessScore} />
        </div>

        {pendingClarifications > 0 && (
          <div className="flex items-center gap-1 text-yellow-600">
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs">{pendingClarifications}</span>
          </div>
        )}
      </div>

      {feature.themes && feature.themes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {feature.themes.slice(0, 2).map((theme) => (
            <span key={theme} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              {theme}
            </span>
          ))}
          {feature.themes.length > 2 && (
            <span className="text-xs text-gray-400">+{feature.themes.length - 2}</span>
          )}
        </div>
      )}
    </div>
  );
}

interface FeatureDetailPanelProps {
  feature: Feature;
  onClose: () => void;
  onStatusChange: (status: string) => void;
}

function FeatureDetailPanel({ feature, onClose, onStatusChange }: FeatureDetailPanelProps) {
  const pendingClarifications = feature.clarifications?.filter((c) => c.status === 'pending') || [];

  return (
    <div className="w-96 rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Feature Details</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Title & Description */}
        <div>
          <h3 className="font-semibold">{feature.title}</h3>
          <p className="mt-1 text-sm text-gray-600">{feature.description}</p>
        </div>

        {/* Status */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
          <select
            value={feature.status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="pending">Pending</option>
            <option value="ready">Ready</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Readiness</label>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="bg-entropy-500 h-full rounded-full"
                  style={{ width: `${Math.round(feature.readinessScore * 100)}%` }}
                />
              </div>
              <span className="text-sm font-medium">
                {Math.round(feature.readinessScore * 100)}%
              </span>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Priority</label>
            <PriorityBadge score={feature.priorityScore} />
          </div>
        </div>

        {/* Themes */}
        {feature.themes && feature.themes.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Themes</label>
            <div className="flex flex-wrap gap-1">
              {feature.themes.map((theme) => (
                <span
                  key={theme}
                  className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600"
                >
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Acceptance Criteria */}
        {feature.acceptanceCriteria && feature.acceptanceCriteria.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Acceptance Criteria
            </label>
            <ul className="space-y-1 text-sm text-gray-600">
              {feature.acceptanceCriteria.map((criterion, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  {criterion}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Clarifications */}
        {pendingClarifications.length > 0 && (
          <div>
            <label className="mb-2 block text-sm font-medium text-yellow-700">
              Pending Clarifications ({pendingClarifications.length})
            </label>
            <div className="space-y-2">
              {pendingClarifications.map((clarification) => (
                <div
                  key={clarification.id}
                  className="rounded-lg border border-yellow-200 bg-yellow-50 p-3"
                >
                  <p className="text-sm text-yellow-800">{clarification.question}</p>
                  <p className="mt-1 text-xs text-yellow-600">
                    Asked {new Date(clarification.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="border-t border-gray-100 pt-4 text-xs text-gray-500">
          <p>Created: {new Date(feature.createdAt).toLocaleDateString()}</p>
          <p>Updated: {new Date(feature.updatedAt).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
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
      <div className="h-2 w-12 overflow-hidden rounded-full bg-gray-200">
        <div className="bg-entropy-500 h-full rounded-full" style={{ width: `${percentage}%` }} />
      </div>
      <span className="text-xs text-gray-500">{percentage}%</span>
    </div>
  );
}
