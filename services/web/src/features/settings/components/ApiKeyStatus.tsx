import { useState } from 'react';
import type { ApiKeyInfo, ApiKeyTestResult, ModelProvider } from '../types';
import { ApiKeyCard } from './ApiKeyCard';
import { SettingsSection } from './SettingsSection';

interface ApiKeyStatusProps {
  apiKeys: ApiKeyInfo[];
  onTestKey: (provider: ModelProvider) => Promise<ApiKeyTestResult>;
  className?: string;
}

export function ApiKeyStatus({ apiKeys, onTestKey, className }: ApiKeyStatusProps) {
  const [testingProvider, setTestingProvider] = useState<ModelProvider | null>(null);
  const [testResults, setTestResults] = useState<Record<ModelProvider, ApiKeyTestResult>>(
    {} as Record<ModelProvider, ApiKeyTestResult>
  );

  const handleTestConnection = async (provider: ModelProvider) => {
    setTestingProvider(provider);
    try {
      const result = await onTestKey(provider);
      setTestResults((prev) => ({ ...prev, [provider]: result }));
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [provider]: {
          provider,
          success: false,
          message: 'Connection test failed',
        },
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  return (
    <SettingsSection
      title="API Keys"
      description="Status of API keys for each model provider"
      className={className}
    >
      <div className="space-y-3">
        {apiKeys.map((apiKey) => (
          <ApiKeyCard
            key={apiKey.provider}
            apiKey={apiKey}
            onTestConnection={() => handleTestConnection(apiKey.provider)}
            isTesting={testingProvider === apiKey.provider}
            testResult={testResults[apiKey.provider]}
          />
        ))}
      </div>
    </SettingsSection>
  );
}
