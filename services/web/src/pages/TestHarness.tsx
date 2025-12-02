import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useState, useEffect } from 'react';
import MetricsCard, { type Metrics } from '../components/test-harness/MetricsCard';
import ModelConfig, {
  type Adapter,
  type TestConfigState,
} from '../components/test-harness/ModelConfig';
import PromptInput from '../components/test-harness/PromptInput';
import ResponseDisplay from '../components/test-harness/ResponseDisplay';

interface CompletionResponse {
  content: string;
  model: string;
  finishReason: string;
  requestId: string;
  metrics: Metrics;
  config: {
    adapterId: string;
    temperature: number;
    maxTokens: number;
  };
}

interface AdaptersResponse {
  adapters: Adapter[];
  defaultAdapterId: string;
}

// API client
const api = axios.create({
  baseURL: '/api/v1/test-harness',
});

export default function TestHarness() {
  // State for response data
  const [responseContent, setResponseContent] = useState<string | null>(null);
  const [responseError, setResponseError] = useState<string | null>(null);
  const [responseMetrics, setResponseMetrics] = useState<Metrics | null>(null);
  const [responseModel, setResponseModel] = useState<string | undefined>();
  const [responseFinishReason, setResponseFinishReason] = useState<string | undefined>();
  const [responseRequestId, setResponseRequestId] = useState<string | undefined>();

  // Local config state
  const [localConfig, setLocalConfig] = useState<TestConfigState>({
    adapterId: 'anthropic-claude-4-sonnet',
    temperature: 0.7,
    maxTokens: 1024,
    simulateFailure: false,
    simulateLatencyMs: 0,
  });

  // Fetch available adapters
  const {
    data: adaptersData,
    isLoading: adaptersLoading,
    error: adaptersError,
  } = useQuery<AdaptersResponse>({
    queryKey: ['adapters'],
    queryFn: async () => {
      const response = await api.get('/adapters');
      return response.data;
    },
  });

  // Fetch current config
  const { data: serverConfig } = useQuery<TestConfigState>({
    queryKey: ['config'],
    queryFn: async () => {
      const response = await api.get('/config');
      return response.data;
    },
  });

  // Sync local config with server on initial load
  useEffect(() => {
    if (serverConfig) {
      setLocalConfig(serverConfig);
    }
  }, [serverConfig]);

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (config: Partial<TestConfigState>) => {
      const response = await api.patch('/config', config);
      return response.data;
    },
  });

  // Completion mutation
  const completionMutation = useMutation({
    mutationFn: async ({ prompt, systemPrompt }: { prompt: string; systemPrompt?: string }) => {
      const response = await api.post<CompletionResponse>('/complete', {
        prompt,
        systemPrompt,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setResponseContent(data.content);
      setResponseError(null);
      setResponseMetrics(data.metrics);
      setResponseModel(data.model);
      setResponseFinishReason(data.finishReason);
      setResponseRequestId(data.requestId);
    },
    onError: (error: unknown) => {
      const errorMessage =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : error instanceof Error
            ? error.message
            : 'Unknown error';
      setResponseContent(null);
      setResponseError(errorMessage);
      setResponseMetrics(null);
    },
  });

  // Health check mutation
  const healthCheckMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<{ adapterId: string; healthy: boolean }>('/health', {
        adapterId: localConfig.adapterId,
      });
      return response.data.healthy;
    },
  });

  const handleConfigChange = (updates: Partial<TestConfigState>) => {
    setLocalConfig((prev) => ({ ...prev, ...updates }));
  };

  const handleApplyConfig = async () => {
    await updateConfigMutation.mutateAsync(localConfig);
  };

  const handleHealthCheck = async () => {
    return await healthCheckMutation.mutateAsync();
  };

  const handleSubmitPrompt = (prompt: string, systemPrompt?: string) => {
    completionMutation.mutate({ prompt, systemPrompt });
  };

  const adapters = adaptersData?.adapters || [];

  if (adaptersError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="mb-2 text-lg font-semibold text-red-700">Failed to load adapters</h2>
        <p className="text-red-600">
          {adaptersError instanceof Error ? adaptersError.message : 'Unknown error'}
        </p>
        <p className="mt-2 text-sm text-red-500">
          Make sure the API server is running on port 3000
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Adapter Test Harness</h1>
        <p className="text-gray-500">Test model adapters with custom configurations</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Left Sidebar - Model Config */}
        <div className="lg:col-span-1">
          <ModelConfig
            adapters={adapters}
            config={localConfig}
            onConfigChange={handleConfigChange}
            onApplyConfig={handleApplyConfig}
            onHealthCheck={handleHealthCheck}
            loading={adaptersLoading}
          />
        </div>

        {/* Main Content Area */}
        <div className="space-y-6 lg:col-span-3">
          {/* Prompt Input */}
          <PromptInput
            onSubmit={handleSubmitPrompt}
            loading={completionMutation.isPending}
            disabled={adaptersLoading || adapters.length === 0}
          />

          {/* Response Display */}
          <ResponseDisplay
            content={responseContent}
            error={responseError}
            loading={completionMutation.isPending}
            model={responseModel}
            finishReason={responseFinishReason}
            requestId={responseRequestId}
          />

          {/* Metrics */}
          <div>
            <h3 className="mb-3 font-semibold text-gray-900">Metrics</h3>
            <MetricsCard metrics={responseMetrics} loading={completionMutation.isPending} />
          </div>
        </div>
      </div>
    </div>
  );
}
