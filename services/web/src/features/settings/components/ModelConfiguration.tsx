import { Info } from 'lucide-react';
import type { ModelAssignment } from '../types';
import { ModelCard } from './ModelCard';
import { SettingsSection } from './SettingsSection';

interface ModelConfigurationProps {
  models: ModelAssignment[];
  className?: string;
}

export function ModelConfiguration({ models, className }: ModelConfigurationProps) {
  return (
    <SettingsSection
      title="Model Configuration"
      description="AI models assigned to each agent type"
      className={className}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {models.map((assignment) => (
          <ModelCard key={assignment.agentType} assignment={assignment} />
        ))}
      </div>

      {/* Info note about model changes */}
      <div className="mt-4 flex items-start gap-2 rounded-lg bg-blue-50 p-3">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
        <p className="text-sm text-blue-700">
          Model changes require admin access. Contact support to modify model assignments.
        </p>
      </div>
    </SettingsSection>
  );
}
