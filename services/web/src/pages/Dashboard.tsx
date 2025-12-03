import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import clsx from 'clsx';
import { TrendingUp, Clock, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const api = axios.create({
  baseURL: '/api/v1',
});

interface FeatureStats {
  total: number;
  ready: number;
  inProgress: number;
  needsAttention: number;
  pending: number;
}

interface RecentFeature {
  id: string;
  title: string;
  status: string;
  readinessScore: number;
  updatedAt: string;
}

export default function Dashboard() {
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery<FeatureStats>({
    queryKey: ['feature-stats'],
    queryFn: async () => {
      const response = await api.get('/features/stats');
      return response.data;
    },
  });

  const {
    data: recentData,
    isLoading: recentLoading,
  } = useQuery<{ features: RecentFeature[] }>({
    queryKey: ['recent-features'],
    queryFn: async () => {
      const response = await api.get('/features/recent');
      return response.data;
    },
  });

  const statCards = [
    {
      title: 'Total Features',
      value: stats?.total ?? 0,
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'In Progress',
      value: stats?.inProgress ?? 0,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      title: 'Ready',
      value: stats?.ready ?? 0,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Needs Attention',
      value: stats?.needsAttention ?? 0,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ];

  if (statsError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="mb-2 text-lg font-semibold text-red-700">Failed to load dashboard</h2>
        <p className="text-red-600">
          {statsError instanceof Error ? statsError.message : 'Unknown error'}
        </p>
        <p className="mt-2 text-sm text-red-500">
          Make sure the API server is running
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500">Overview of your feature backlog</p>
        </div>
        <Link
          to="/intake"
          className="bg-entropy-600 hover:bg-entropy-700 flex items-center gap-2 rounded-lg px-4 py-2 text-white transition-colors"
        >
          Add Requirement
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <StatCard
            key={card.title}
            title={card.title}
            value={card.value}
            icon={card.icon}
            color={card.color}
            bgColor={card.bgColor}
            loading={statsLoading}
          />
        ))}
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <Link
            to="/backlog"
            className="text-entropy-600 hover:text-entropy-700 text-sm font-medium"
          >
            View All
          </Link>
        </div>

        {recentLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 rounded-lg bg-gray-100" />
              </div>
            ))}
          </div>
        ) : recentData?.features && recentData.features.length > 0 ? (
          <div className="space-y-3">
            {recentData.features.map((feature) => (
              <FeatureRow key={feature.id} feature={feature} />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-gray-500">No recent activity</p>
            <Link
              to="/intake"
              className="text-entropy-600 hover:text-entropy-700 mt-2 inline-block text-sm font-medium"
            >
              Upload your first requirement
            </Link>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <QuickLinkCard
          title="Test Model Adapters"
          description="Test AI model configurations and responses"
          to="/test-harness"
        />
        <QuickLinkCard
          title="System Health"
          description="Monitor database, storage, and service status"
          to="/health"
        />
        <QuickLinkCard
          title="Feature Backlog"
          description="View and manage decomposed features"
          to="/backlog"
        />
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  loading?: boolean;
}

function StatCard({ title, value, icon: Icon, color, bgColor, loading }: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="mb-1 text-sm text-gray-500">{title}</p>
          {loading ? (
            <div className="h-9 w-16 animate-pulse rounded bg-gray-200" />
          ) : (
            <p className="text-3xl font-bold">{value}</p>
          )}
        </div>
        <div className={clsx('rounded-lg p-3', bgColor)}>
          <Icon className={clsx('h-6 w-6', color)} />
        </div>
      </div>
    </div>
  );
}

function FeatureRow({ feature }: { feature: RecentFeature }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    ready: { label: 'Ready', className: 'bg-green-100 text-green-700' },
    in_progress: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-700' },
    pending: { label: 'Pending', className: 'bg-gray-100 text-gray-700' },
    done: { label: 'Done', className: 'bg-blue-100 text-blue-700' },
  };

  const status = statusConfig[feature.status] || statusConfig.pending;

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-100 p-4 hover:bg-gray-50">
      <div className="flex-1">
        <h3 className="font-medium">{feature.title}</h3>
        <p className="text-sm text-gray-500">
          Updated {new Date(feature.updatedAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="flex items-center gap-1">
            <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200">
              <div
                className="bg-entropy-500 h-full rounded-full"
                style={{ width: `${Math.round(feature.readinessScore * 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">
              {Math.round(feature.readinessScore * 100)}%
            </span>
          </div>
        </div>
        <span className={clsx('rounded-full px-2 py-1 text-xs font-medium', status.className)}>
          {status.label}
        </span>
      </div>
    </div>
  );
}

function QuickLinkCard({
  title,
  description,
  to,
}: {
  title: string;
  description: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="block rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
    >
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </Link>
  );
}
