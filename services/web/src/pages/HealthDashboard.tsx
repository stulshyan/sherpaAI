import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import clsx from 'clsx';
import {
  Database,
  HardDrive,
  Server,
  Cpu,
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
} from 'lucide-react';

// API client
const api = axios.create({
  baseURL: '/api/v1',
});

interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  message?: string;
}

interface DatabaseHealth {
  status: 'up' | 'down';
  latencyMs: number;
  tables: Array<{
    name: string;
    rowCount: number;
  }>;
  poolStats?: {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  };
}

interface StorageHealth {
  status: 'up' | 'down' | 'not_configured';
  bucket?: string;
  objectCount?: number;
  totalSizeBytes?: number;
  recentObjects?: Array<{
    key: string;
    size: number;
    lastModified: string;
  }>;
  message?: string;
}

interface CacheHealth {
  status: 'up' | 'down' | 'not_configured';
  latencyMs?: number;
  memoryUsedMb?: number;
  keyCount?: number;
  hitRate?: number;
  message?: string;
}

interface AdapterHealth {
  id: string;
  provider: string;
  model: string;
  healthy: boolean;
  latencyMs?: number;
}

interface SystemHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    api: ServiceStatus;
    database?: DatabaseHealth;
    storage?: StorageHealth;
    cache?: CacheHealth;
  };
  adapters?: AdapterHealth[];
}

export default function HealthDashboard() {
  const {
    data: health,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<SystemHealthResponse>({
    queryKey: ['system-health'],
    queryFn: async () => {
      const response = await api.get('/health/detailed');
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="mb-2 text-lg font-semibold text-red-700">Failed to load health status</h2>
        <p className="text-red-600">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
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
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Health</h1>
          <p className="text-gray-500">Monitor infrastructure and service status</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className={clsx(
            'flex items-center gap-2 rounded-lg px-4 py-2 transition-colors',
            isFetching
              ? 'bg-gray-100 text-gray-400'
              : 'bg-entropy-600 text-white hover:bg-entropy-700'
          )}
        >
          <RefreshCw className={clsx('h-4 w-4', isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Overall Status Banner */}
      <div
        className={clsx(
          'mb-6 rounded-lg p-4',
          isLoading
            ? 'bg-gray-100'
            : health?.status === 'healthy'
              ? 'bg-green-50 border border-green-200'
              : health?.status === 'degraded'
                ? 'bg-yellow-50 border border-yellow-200'
                : 'bg-red-50 border border-red-200'
        )}
      >
        <div className="flex items-center gap-3">
          {isLoading ? (
            <div className="h-6 w-6 animate-pulse rounded-full bg-gray-300" />
          ) : health?.status === 'healthy' ? (
            <CheckCircle className="h-6 w-6 text-green-600" />
          ) : (
            <XCircle className="h-6 w-6 text-red-600" />
          )}
          <div>
            <p className="font-semibold">
              {isLoading
                ? 'Checking...'
                : health?.status === 'healthy'
                  ? 'All Systems Operational'
                  : health?.status === 'degraded'
                    ? 'Some Services Degraded'
                    : 'System Issues Detected'}
            </p>
            {health?.timestamp && (
              <p className="text-sm text-gray-500">
                Last checked: {new Date(health.timestamp).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Service Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Database Card */}
        <ServiceCard
          icon={Database}
          title="Database"
          subtitle="PostgreSQL"
          loading={isLoading}
          status={health?.services.database?.status}
          latencyMs={health?.services.database?.latencyMs}
        >
          {health?.services.database && health.services.database.status === 'up' && (
            <div className="mt-4 space-y-3">
              {/* Pool Stats */}
              {health.services.database.poolStats && (
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Pool Total:</span>{' '}
                    <span className="font-medium">{health.services.database.poolStats.totalCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Idle:</span>{' '}
                    <span className="font-medium">{health.services.database.poolStats.idleCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Waiting:</span>{' '}
                    <span className="font-medium">{health.services.database.poolStats.waitingCount}</span>
                  </div>
                </div>
              )}

              {/* Tables */}
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">Tables</p>
                <div className="max-h-40 overflow-y-auto rounded border border-gray-200 bg-gray-50">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Table</th>
                        <th className="px-3 py-2 text-right font-medium">Rows</th>
                      </tr>
                    </thead>
                    <tbody>
                      {health.services.database.tables.map((table) => (
                        <tr key={table.name} className="border-t border-gray-200">
                          <td className="px-3 py-2 font-mono text-xs">{table.name}</td>
                          <td className="px-3 py-2 text-right">{table.rowCount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </ServiceCard>

        {/* Storage Card */}
        <ServiceCard
          icon={HardDrive}
          title="Storage"
          subtitle="AWS S3"
          loading={isLoading}
          status={health?.services.storage?.status}
          message={health?.services.storage?.message}
        >
          {health?.services.storage && health.services.storage.status === 'up' && (
            <div className="mt-4 space-y-3">
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Bucket:</span>{' '}
                  <span className="font-mono text-xs">{health.services.storage.bucket}</span>
                </div>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Objects:</span>{' '}
                  <span className="font-medium">{health.services.storage.objectCount?.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total Size:</span>{' '}
                  <span className="font-medium">
                    {formatBytes(health.services.storage.totalSizeBytes || 0)}
                  </span>
                </div>
              </div>

              {/* Recent Objects */}
              {health.services.storage.recentObjects && health.services.storage.recentObjects.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-700">Recent Objects</p>
                  <div className="max-h-32 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-2">
                    {health.services.storage.recentObjects.map((obj) => (
                      <div
                        key={obj.key}
                        className="flex items-center justify-between py-1 text-xs"
                      >
                        <span className="truncate font-mono">{obj.key}</span>
                        <span className="text-gray-500">{formatBytes(obj.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ServiceCard>

        {/* Cache Card */}
        <ServiceCard
          icon={Server}
          title="Cache"
          subtitle="Redis"
          loading={isLoading}
          status={health?.services.cache?.status}
          latencyMs={health?.services.cache?.latencyMs}
          message={health?.services.cache?.message}
        >
          {health?.services.cache && health.services.cache.status === 'up' && (
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Memory Used:</span>{' '}
                <span className="font-medium">{health.services.cache.memoryUsedMb?.toFixed(1)} MB</span>
              </div>
              <div>
                <span className="text-gray-500">Keys:</span>{' '}
                <span className="font-medium">{health.services.cache.keyCount?.toLocaleString()}</span>
              </div>
              {health.services.cache.hitRate !== undefined && (
                <div>
                  <span className="text-gray-500">Hit Rate:</span>{' '}
                  <span className="font-medium">{(health.services.cache.hitRate * 100).toFixed(1)}%</span>
                </div>
              )}
            </div>
          )}
        </ServiceCard>

        {/* Adapters Card */}
        <ServiceCard
          icon={Cpu}
          title="Model Adapters"
          subtitle="AI Providers"
          loading={isLoading}
          status={
            health?.adapters?.every((a) => a.healthy)
              ? 'up'
              : health?.adapters?.some((a) => a.healthy)
                ? 'degraded'
                : 'down'
          }
        >
          {health?.adapters && (
            <div className="mt-4 space-y-2">
              {health.adapters.map((adapter) => (
                <div
                  key={adapter.id}
                  className={clsx(
                    'flex items-center justify-between rounded-lg p-3',
                    adapter.healthy ? 'bg-green-50' : 'bg-red-50'
                  )}
                >
                  <div>
                    <p className="font-medium text-sm">{adapter.provider}</p>
                    <p className="text-xs text-gray-500">{adapter.model}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {adapter.latencyMs && (
                      <span className="text-xs text-gray-500">{adapter.latencyMs}ms</span>
                    )}
                    {adapter.healthy ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ServiceCard>
      </div>
    </div>
  );
}

interface ServiceCardProps {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  loading?: boolean;
  status?: 'up' | 'down' | 'degraded' | 'not_configured';
  latencyMs?: number;
  message?: string;
  children?: React.ReactNode;
}

function ServiceCard({
  icon: Icon,
  title,
  subtitle,
  loading,
  status,
  latencyMs,
  message,
  children,
}: ServiceCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              'rounded-lg p-2',
              loading
                ? 'bg-gray-100'
                : status === 'up'
                  ? 'bg-green-100'
                  : status === 'not_configured'
                    ? 'bg-gray-100'
                    : 'bg-red-100'
            )}
          >
            <Icon
              className={clsx(
                'h-5 w-5',
                loading
                  ? 'text-gray-400'
                  : status === 'up'
                    ? 'text-green-600'
                    : status === 'not_configured'
                      ? 'text-gray-400'
                      : 'text-red-600'
              )}
            />
          </div>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
        </div>

        <div className="text-right">
          {loading ? (
            <div className="h-5 w-16 animate-pulse rounded bg-gray-200" />
          ) : (
            <>
              <StatusBadge status={status} />
              {latencyMs !== undefined && (
                <div className="mt-1 flex items-center justify-end gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  {latencyMs}ms
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {message && status !== 'up' && (
        <p className="mt-3 text-sm text-gray-500">{message}</p>
      )}

      {children}
    </div>
  );
}

function StatusBadge({ status }: { status?: 'up' | 'down' | 'degraded' | 'not_configured' }) {
  if (!status) return null;

  const config = {
    up: { label: 'Healthy', className: 'bg-green-100 text-green-700' },
    down: { label: 'Down', className: 'bg-red-100 text-red-700' },
    degraded: { label: 'Degraded', className: 'bg-yellow-100 text-yellow-700' },
    not_configured: { label: 'Not Configured', className: 'bg-gray-100 text-gray-600' },
  };

  const { label, className } = config[status];

  return <span className={clsx('rounded-full px-2 py-1 text-xs font-medium', className)}>{label}</span>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
