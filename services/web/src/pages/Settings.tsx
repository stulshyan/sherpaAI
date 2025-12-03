import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import clsx from 'clsx';
import { CheckCircle, XCircle, Loader2, Save, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

const api = axios.create({
  baseURL: '/api/v1',
});

interface ApiKeysResponse {
  keys: Record<string, { configured: boolean; preview: string }>;
  providers: string[];
}

interface ApiKeyStatusResponse {
  status: Record<string, { configured: boolean; healthy: boolean | null }>;
}

export default function Settings() {
  const queryClient = useQueryClient();

  // Form state for API keys
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [googleKey, setGoogleKey] = useState('');

  // Show/hide password state
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  const [showGoogle, setShowGoogle] = useState(false);

  // Track if keys have been modified
  const [isDirty, setIsDirty] = useState(false);

  // Fetch current API key status
  const { data: keysData, isLoading: keysLoading } = useQuery<ApiKeysResponse>({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const response = await api.get('/settings/api-keys');
      return response.data;
    },
  });

  // Fetch API key health status
  const {
    data: statusData,
    isLoading: statusLoading,
    refetch: refetchStatus,
  } = useQuery<ApiKeyStatusResponse>({
    queryKey: ['api-keys-status'],
    queryFn: async () => {
      const response = await api.get('/settings/api-keys/status');
      return response.data;
    },
    enabled: !!keysData,
  });

  // Save API keys mutation
  const saveMutation = useMutation({
    mutationFn: async (keys: { anthropic?: string; openai?: string; google?: string }) => {
      const response = await api.post('/settings/api-keys', keys);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      queryClient.invalidateQueries({ queryKey: ['api-keys-status'] });
      setIsDirty(false);
      // Clear the input fields after save
      setAnthropicKey('');
      setOpenaiKey('');
      setGoogleKey('');
    },
  });

  const handleSave = () => {
    const keys: { anthropic?: string; openai?: string; google?: string } = {};
    if (anthropicKey) keys.anthropic = anthropicKey;
    if (openaiKey) keys.openai = openaiKey;
    if (googleKey) keys.google = googleKey;

    if (Object.keys(keys).length > 0) {
      saveMutation.mutate(keys);
    }
  };

  // Mark as dirty when any key changes
  useEffect(() => {
    setIsDirty(anthropicKey !== '' || openaiKey !== '' || googleKey !== '');
  }, [anthropicKey, openaiKey, googleKey]);

  const getStatusIcon = (provider: string) => {
    const status = statusData?.status[provider];
    if (!status?.configured) {
      return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
    if (status.healthy === null) {
      return <Loader2 className="h-5 w-5 animate-spin text-gray-400" />;
    }
    if (status.healthy) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  const getStatusText = (provider: string) => {
    const status = statusData?.status[provider];
    if (!status?.configured) {
      return 'Not configured';
    }
    if (status.healthy === null) {
      return 'Checking...';
    }
    if (status.healthy) {
      return 'Connected';
    }
    return 'Connection failed';
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      {/* API Keys Section */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">API Keys</h2>
            <p className="text-sm text-gray-500">
              Configure API keys for model providers. Keys are stored in memory and will need to be
              re-entered if the server restarts.
            </p>
          </div>
          <button
            onClick={() => refetchStatus()}
            disabled={statusLoading}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            {statusLoading ? 'Checking...' : 'Check Status'}
          </button>
        </div>

        {keysLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Anthropic API Key */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">Anthropic API Key</label>
                <div className="flex items-center gap-2">
                  {getStatusIcon('anthropic')}
                  <span className="text-sm text-gray-500">{getStatusText('anthropic')}</span>
                </div>
              </div>
              {keysData?.keys.anthropic?.configured && (
                <p className="mb-2 text-xs text-gray-500">
                  Current: {keysData.keys.anthropic.preview}
                </p>
              )}
              <div className="relative">
                <input
                  type={showAnthropic ? 'text' : 'password'}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10"
                  placeholder={
                    keysData?.keys.anthropic?.configured
                      ? 'Enter new key to replace...'
                      : 'sk-ant-api03-...'
                  }
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowAnthropic(!showAnthropic)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showAnthropic ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* OpenAI API Key */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">OpenAI API Key</label>
                <div className="flex items-center gap-2">
                  {getStatusIcon('openai')}
                  <span className="text-sm text-gray-500">{getStatusText('openai')}</span>
                </div>
              </div>
              {keysData?.keys.openai?.configured && (
                <p className="mb-2 text-xs text-gray-500">
                  Current: {keysData.keys.openai.preview}
                </p>
              )}
              <div className="relative">
                <input
                  type={showOpenai ? 'text' : 'password'}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10"
                  placeholder={
                    keysData?.keys.openai?.configured
                      ? 'Enter new key to replace...'
                      : 'sk-proj-...'
                  }
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowOpenai(!showOpenai)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showOpenai ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Google API Key */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">Google AI API Key</label>
                <div className="flex items-center gap-2">
                  {getStatusIcon('google')}
                  <span className="text-sm text-gray-500">{getStatusText('google')}</span>
                </div>
              </div>
              {keysData?.keys.google?.configured && (
                <p className="mb-2 text-xs text-gray-500">
                  Current: {keysData.keys.google.preview}
                </p>
              )}
              <div className="relative">
                <input
                  type={showGoogle ? 'text' : 'password'}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10"
                  placeholder={
                    keysData?.keys.google?.configured ? 'Enter new key to replace...' : 'AIza...'
                  }
                  value={googleKey}
                  onChange={(e) => setGoogleKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowGoogle(!showGoogle)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showGoogle ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between pt-2">
              <div>
                {saveMutation.isSuccess && (
                  <p className="text-sm text-green-600">API keys saved successfully!</p>
                )}
                {saveMutation.isError && (
                  <p className="text-sm text-red-600">
                    Failed to save:{' '}
                    {saveMutation.error instanceof Error
                      ? saveMutation.error.message
                      : 'Unknown error'}
                  </p>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={!isDirty || saveMutation.isPending}
                className={clsx(
                  'flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors',
                  isDirty
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'cursor-not-allowed bg-gray-100 text-gray-400'
                )}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save API Keys
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Project Information */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Project Information</h2>

        <div className="space-y-2 text-sm">
          <p>
            <span className="text-gray-500">Version:</span> 0.1.0
          </p>
          <p>
            <span className="text-gray-500">Environment:</span> Development
          </p>
        </div>
      </div>
    </div>
  );
}
