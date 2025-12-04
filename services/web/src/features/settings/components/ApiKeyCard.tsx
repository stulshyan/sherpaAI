import clsx from 'clsx';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import type { ApiKeyInfo, ApiKeyTestResult } from '../types';
import { getStatusLabel, PROVIDER_CONFIG, STATUS_CONFIG } from '../types';
import { Button } from '@/components/ui';

interface ApiKeyCardProps {
  apiKey: ApiKeyInfo;
  onTestConnection: () => void;
  isTesting?: boolean;
  testResult?: ApiKeyTestResult;
  className?: string;
}

export function ApiKeyCard({
  apiKey,
  onTestConnection,
  isTesting = false,
  testResult,
  className,
}: ApiKeyCardProps) {
  const statusConfig = STATUS_CONFIG[apiKey.status];
  const providerConfig = PROVIDER_CONFIG[apiKey.provider];

  return (
    <div className={clsx('rounded-lg border border-gray-100 bg-gray-50 p-4', className)}>
      <div className="flex items-center justify-between">
        {/* Provider Name */}
        <div className="flex items-center gap-3">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
            style={{ backgroundColor: providerConfig.bgColor, color: providerConfig.color }}
          >
            {providerConfig.name[0]}
          </span>
          <div>
            <span className="block text-sm font-medium text-gray-900">{apiKey.providerName}</span>
            {apiKey.maskedKey && (
              <span className="font-mono text-xs text-gray-500">{apiKey.maskedKey}</span>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-3">
          <span className={clsx('flex items-center gap-1 text-sm', statusConfig.text)}>
            {statusConfig.icon} {getStatusLabel(apiKey.status)}
          </span>
        </div>
      </div>

      {/* Test Connection Button */}
      <div className="mt-3">
        {apiKey.status !== 'not_configured' ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={onTestConnection}
            disabled={isTesting}
            className="w-full"
          >
            {isTesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </Button>
        ) : (
          <Button variant="secondary" size="sm" disabled className="w-full opacity-50">
            Add Key (coming soon)
          </Button>
        )}

        {/* Test Result */}
        {testResult && !isTesting && (
          <div
            className={clsx(
              'mt-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm',
              testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            )}
          >
            {testResult.success ? (
              <>
                <CheckCircle className="h-4 w-4" />
                {testResult.message}
                {testResult.latencyMs && (
                  <span className="ml-auto text-xs opacity-75">({testResult.latencyMs}ms)</span>
                )}
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" />
                {testResult.message}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
