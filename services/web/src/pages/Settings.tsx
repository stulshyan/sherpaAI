import { Loader2, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui';
import {
  AboutSection,
  ApiKeyStatus,
  ModelConfiguration,
  ProcessingLimits,
  ProjectSettings,
  testApiKey,
  useSettings,
  useUpdateProjectDescription,
} from '@/features/settings';

export default function Settings() {
  const { data: settings, isLoading, error, refetch } = useSettings();
  const updateDescription = useUpdateProjectDescription();

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <SettingsIcon className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Failed to load settings</h3>
          <p className="mt-1 text-sm text-gray-500">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <Button variant="primary" className="mt-4" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <SettingsIcon className="h-6 w-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>

      <div className="space-y-6">
        {/* Project Settings */}
        <ProjectSettings
          project={settings.project}
          onUpdateDescription={(description) => updateDescription.mutate(description)}
          isUpdating={updateDescription.isPending}
        />

        {/* Model Configuration */}
        <ModelConfiguration models={settings.models} />

        {/* API Keys */}
        <ApiKeyStatus apiKeys={settings.apiKeys} onTestKey={testApiKey} />

        {/* Processing Limits */}
        <ProcessingLimits limits={settings.limits} />

        {/* About Section */}
        <AboutSection platform={settings.platform} />
      </div>
    </div>
  );
}
