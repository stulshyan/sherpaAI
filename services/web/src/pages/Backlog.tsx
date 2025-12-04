import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import clsx from 'clsx';
import {
  RefreshCw,
  MessageSquare,
  Search,
  AlertTriangle,
  X,
  ChevronRight,
  Link as LinkIcon,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { Input, Button } from '@/components/ui';
import {
  type Feature,
  type BacklogSummary,
  BACKLOG_COLUMNS,
  getPriorityColor,
  getPriorityLabel,
} from '@/features/backlog/types';

const api = axios.create({
  baseURL: '/api/v1',
});

export default function Backlog() {
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [minReadiness, setMinReadiness] = useState(0);

  // Fetch backlog summary with auto-refresh
  const {
    data: backlogData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<BacklogSummary>({
    queryKey: ['backlog-summary', searchQuery, minReadiness],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (minReadiness > 0) params.set('minReadiness', minReadiness.toString());
      const response = await api.get(`/backlog/summary?${params.toString()}`);
      return response.data;
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    staleTime: 10000,
  });

  // Debounced search
  const handleSearchChange = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return (value: string) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setSearchQuery(value);
      }, 300);
    };
  }, []);

  const totalFeatures = backlogData?.totalFeatures || 0;
  const hasFilters = searchQuery || minReadiness > 0;

  const clearFilters = () => {
    setSearchQuery('');
    setMinReadiness(0);
  };

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
        <h2 className="mb-2 text-lg font-semibold text-red-700 dark:text-red-400">
          Failed to load backlog
        </h2>
        <p className="text-red-600 dark:text-red-300">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
        <Button
          variant="danger"
          className="mt-4"
          onClick={() => refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Feature Backlog
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {totalFeatures} features
            {hasFilters && ' (filtered)'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Input
              placeholder="Search features..."
              defaultValue={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>

          {/* Readiness Filter */}
          <select
            value={minReadiness}
            onChange={(e) => setMinReadiness(parseFloat(e.target.value))}
            className="h-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-800"
          >
            <option value="0">All Readiness</option>
            <option value="0.5">50%+</option>
            <option value="0.7">70%+</option>
            <option value="0.9">90%+</option>
          </select>

          {/* Clear Filters */}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              leftIcon={<X className="h-4 w-4" />}
            >
              Clear
            </Button>
          )}

          {/* Refresh */}
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            leftIcon={
              <RefreshCw
                className={clsx('h-4 w-4', isFetching && 'animate-spin')}
              />
            }
          >
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
          {BACKLOG_COLUMNS.map((column) => (
            <div
              key={column.id}
              className="animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800 p-4"
            >
              <div className="mb-4 h-6 w-24 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="space-y-2">
                <div className="h-28 rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div className="h-28 rounded-lg bg-gray-200 dark:bg-gray-700" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-w-[900px]">
            {BACKLOG_COLUMNS.map((column) => {
              const columnData = backlogData?.[column.key];
              const features = columnData?.items || [];
              const count = columnData?.count || 0;

              return (
                <div
                  key={column.id}
                  className={clsx(
                    'rounded-lg p-4 min-h-[400px]',
                    column.bgColor
                  )}
                >
                  {/* Column Header */}
                  <div className="mb-4 flex items-center gap-2">
                    <span className="text-lg">{column.icon}</span>
                    <h2 className="font-semibold text-gray-900 dark:text-white">
                      {column.title}
                    </h2>
                    <span className="rounded-full bg-white/50 dark:bg-black/20 px-2 py-0.5 text-sm font-medium text-gray-600 dark:text-gray-300">
                      {count}
                    </span>
                  </div>

                  {/* Feature Cards */}
                  <div className="space-y-3">
                    {features.map((feature) => (
                      <FeatureCard
                        key={feature.id}
                        feature={feature}
                        onClick={() => setSelectedFeature(feature)}
                        isSelected={selectedFeature?.id === feature.id}
                      />
                    ))}

                    {features.length === 0 && (
                      <div className="py-8 text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {column.emptyMessage}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail Panel (Slide-in) */}
      {selectedFeature && (
        <FeatureDetailPanel
          feature={selectedFeature}
          onClose={() => setSelectedFeature(null)}
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
  const hasBlocker = feature.blockedBy && feature.blockedBy.length > 0;
  const hasQuestions = feature.pendingQuestions > 0;

  return (
    <div
      onClick={onClick}
      className={clsx(
        'cursor-pointer rounded-lg border bg-white dark:bg-gray-800 p-4 transition-all hover:shadow-md',
        isSelected
          ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800'
          : 'border-gray-200 dark:border-gray-700'
      )}
    >
      {/* Feature ID */}
      <p className="text-xs font-mono text-gray-400 dark:text-gray-500 mb-1">
        {feature.id.toUpperCase()}
      </p>

      {/* Title */}
      <h3 className="font-medium text-gray-900 dark:text-white mb-2 line-clamp-2">
        {feature.title}
      </h3>

      {/* Loop Indicator (for Now Playing) */}
      {feature.currentLoop && (
        <div className="flex items-center gap-2 mb-3">
          <LoopIndicator loop={feature.currentLoop} />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Loop {feature.currentLoop}: {feature.loopProgress || 0}%
          </span>
        </div>
      )}

      {/* Priority & Readiness */}
      <div className="flex items-center justify-between mb-2">
        <PriorityBadge score={feature.priorityScore} />
        <ReadinessBar score={feature.readinessScore} />
      </div>

      {/* Warnings/Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {hasBlocker && (
          <div
            className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs text-red-600 dark:text-red-400"
            title={`Blocked by: ${feature.blockedBy?.join(', ')}`}
          >
            <AlertTriangle className="h-3 w-3" />
            Blocked
          </div>
        )}
        {hasQuestions && (
          <div className="flex items-center gap-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 text-xs text-yellow-600 dark:text-yellow-400">
            <MessageSquare className="h-3 w-3" />
            {feature.pendingQuestions} question
            {feature.pendingQuestions > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Themes */}
      {feature.themes && feature.themes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {feature.themes.slice(0, 2).map((theme) => (
            <span
              key={theme}
              className="rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-xs text-gray-600 dark:text-gray-300"
            >
              {theme}
            </span>
          ))}
          {feature.themes.length > 2 && (
            <span className="text-xs text-gray-400">
              +{feature.themes.length - 2}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function LoopIndicator({ loop }: { loop: 'A' | 'B' | 'C' }) {
  const loopIndex = { A: 0, B: 1, C: 2 }[loop];

  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={clsx(
            'h-2 w-2 rounded-full',
            i <= loopIndex
              ? 'bg-green-500'
              : 'bg-gray-300 dark:bg-gray-600'
          )}
        />
      ))}
    </div>
  );
}

function PriorityBadge({ score }: { score: number }) {
  const color = getPriorityColor(score);
  const label = getPriorityLabel(score);

  return (
    <div className="flex items-center gap-1.5">
      <div className={clsx('h-2.5 w-2.5 rounded-full', color)} />
      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
        {score.toFixed(2)}
      </span>
      <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
    </div>
  );
}

function ReadinessBar({ score }: { score: number }) {
  const percentage = Math.round(score * 100);

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
        <div
          className={clsx(
            'h-full rounded-full transition-all',
            percentage >= 80
              ? 'bg-green-500'
              : percentage >= 60
                ? 'bg-yellow-500'
                : 'bg-gray-400'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {percentage}%
      </span>
    </div>
  );
}

interface FeatureDetailPanelProps {
  feature: Feature;
  onClose: () => void;
}

function FeatureDetailPanel({ feature, onClose }: FeatureDetailPanelProps) {
  const hasBlocker = feature.blockedBy && feature.blockedBy.length > 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-gray-800 shadow-xl z-50 overflow-y-auto animate-slide-in">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono text-gray-400 dark:text-gray-500">
              {feature.id.toUpperCase()}
            </p>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Feature Details
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Title & Description */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
              {feature.title}
            </h3>
            {feature.description && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {feature.description}
              </p>
            )}
          </div>

          {/* Loop Progress */}
          {feature.currentLoop && (
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <LoopIndicator loop={feature.currentLoop} />
                  <span className="font-medium text-green-700 dark:text-green-400">
                    Loop {feature.currentLoop}
                  </span>
                </div>
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  {feature.loopProgress || 0}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-green-200 dark:bg-green-800">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${feature.loopProgress || 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Blocker Warning */}
          {hasBlocker && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-2">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">Blocked</span>
              </div>
              <p className="text-sm text-red-600 dark:text-red-300">
                This feature is blocked by:
              </p>
              <div className="mt-2 space-y-1">
                {feature.blockedBy?.map((blockerId) => (
                  <div
                    key={blockerId}
                    className="flex items-center gap-2 text-sm text-red-600 dark:text-red-300"
                  >
                    <LinkIcon className="h-3 w-3" />
                    {blockerId.toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Questions */}
          {feature.pendingQuestions > 0 && (
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4">
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                <MessageSquare className="h-5 w-5" />
                <span className="font-medium">
                  {feature.pendingQuestions} Pending Question
                  {feature.pendingQuestions > 1 ? 's' : ''}
                </span>
              </div>
              <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-300">
                This feature needs clarification before it can proceed.
              </p>
            </div>
          )}

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Priority
              </label>
              <div className="mt-2">
                <PriorityBadge score={feature.priorityScore} />
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Readiness
              </label>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
                  <div
                    className="h-full bg-primary-500 rounded-full"
                    style={{
                      width: `${Math.round(feature.readinessScore * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {Math.round(feature.readinessScore * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Themes */}
          {feature.themes && feature.themes.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Themes
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {feature.themes.map((theme) => (
                  <span
                    key={theme}
                    className="rounded-full bg-primary-100 dark:bg-primary-900/30 px-3 py-1 text-sm text-primary-700 dark:text-primary-300"
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
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Acceptance Criteria
              </label>
              <ul className="mt-2 space-y-2">
                {feature.acceptanceCriteria.map((criterion, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500 flex-shrink-0" />
                    {criterion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Timestamps */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>Created: {new Date(feature.createdAt).toLocaleDateString()}</p>
            <p>Updated: {new Date(feature.updatedAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </>
  );
}
