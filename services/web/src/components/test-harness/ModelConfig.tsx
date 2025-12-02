import { RefreshCw, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { useState } from 'react';

export interface Adapter {
  id: string;
  provider: string;
  model: string;
}

export interface TestConfigState {
  adapterId: string;
  temperature: number;
  maxTokens: number;
  simulateFailure: boolean;
  simulateLatencyMs: number;
}

interface ModelConfigProps {
  adapters: Adapter[];
  config: TestConfigState;
  onConfigChange: (config: Partial<TestConfigState>) => void;
  onApplyConfig: () => Promise<void>;
  onHealthCheck: () => Promise<boolean>;
  loading?: boolean;
}

export default function ModelConfig({
  adapters,
  config,
  onConfigChange,
  onApplyConfig,
  onHealthCheck,
  loading,
}: ModelConfigProps) {
  const [applying, setApplying] = useState(false);
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthStatus, setHealthStatus] = useState<boolean | null>(null);
  const [configApplied, setConfigApplied] = useState(false);

  const handleApply = async () => {
    setApplying(true);
    setConfigApplied(false);
    try {
      await onApplyConfig();
      setConfigApplied(true);
      setTimeout(() => setConfigApplied(false), 2000);
    } finally {
      setApplying(false);
    }
  };

  const handleHealthCheck = async () => {
    setHealthChecking(true);
    setHealthStatus(null);
    try {
      const healthy = await onHealthCheck();
      setHealthStatus(healthy);
    } finally {
      setHealthChecking(false);
    }
  };

  const selectedAdapter = adapters.find((a) => a.id === config.adapterId);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-4 font-semibold text-gray-900">Model Configuration</h3>

      {/* Adapter Selection */}
      <div className="mb-4">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Provider / Model</label>
        <select
          value={config.adapterId}
          onChange={(e) => onConfigChange({ adapterId: e.target.value })}
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-entropy-500 focus:outline-none focus:ring-1 focus:ring-entropy-500"
          disabled={loading}
        >
          {adapters.map((adapter) => (
            <option key={adapter.id} value={adapter.id}>
              {adapter.provider} / {adapter.model}
            </option>
          ))}
        </select>
        {selectedAdapter && (
          <p className="mt-1 text-xs text-gray-400">ID: {selectedAdapter.id}</p>
        )}
      </div>

      {/* Temperature */}
      <div className="mb-4">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Temperature: {config.temperature.toFixed(1)}
        </label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={config.temperature}
          onChange={(e) => onConfigChange({ temperature: parseFloat(e.target.value) })}
          className="w-full accent-entropy-600"
          disabled={loading}
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>Precise</span>
          <span>Creative</span>
        </div>
      </div>

      {/* Max Tokens */}
      <div className="mb-4">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Max Tokens</label>
        <input
          type="number"
          min="1"
          max="8192"
          value={config.maxTokens}
          onChange={(e) => onConfigChange({ maxTokens: parseInt(e.target.value, 10) || 1024 })}
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-entropy-500 focus:outline-none focus:ring-1 focus:ring-entropy-500"
          disabled={loading}
        />
      </div>

      <hr className="my-4 border-gray-100" />

      {/* Failure Simulation */}
      <div className="mb-4">
        <h4 className="mb-2 text-sm font-medium text-gray-700">Failure Simulation</h4>

        <label className="mb-3 flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={config.simulateFailure}
            onChange={(e) => onConfigChange({ simulateFailure: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-entropy-600 focus:ring-entropy-500"
            disabled={loading}
          />
          <span className="text-sm text-gray-600">Simulate API Failure</span>
          {config.simulateFailure && (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
        </label>

        <div>
          <label className="mb-1 block text-xs text-gray-500">Simulated Latency (ms)</label>
          <input
            type="number"
            min="0"
            max="10000"
            step="100"
            value={config.simulateLatencyMs}
            onChange={(e) => onConfigChange({ simulateLatencyMs: parseInt(e.target.value, 10) || 0 })}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-entropy-500 focus:outline-none focus:ring-1 focus:ring-entropy-500"
            disabled={loading}
          />
        </div>
      </div>

      <hr className="my-4 border-gray-100" />

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={handleApply}
          disabled={applying || loading}
          className="bg-entropy-600 hover:bg-entropy-700 disabled:bg-entropy-300 flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed"
        >
          {applying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Applying...</span>
            </>
          ) : configApplied ? (
            <>
              <Check className="h-4 w-4" />
              <span>Applied!</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              <span>Apply Config</span>
            </>
          )}
        </button>

        <button
          onClick={handleHealthCheck}
          disabled={healthChecking || loading}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {healthChecking ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Checking...</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              <span>Health Check</span>
            </>
          )}
        </button>

        {healthStatus !== null && (
          <div
            className={`flex items-center justify-center gap-2 rounded-md p-2 text-sm ${
              healthStatus
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {healthStatus ? (
              <>
                <Check className="h-4 w-4" />
                <span>Adapter is healthy</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4" />
                <span>Adapter unhealthy</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
