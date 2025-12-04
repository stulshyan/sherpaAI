import clsx from 'clsx';
import { Book, FileText, MessageCircle } from 'lucide-react';
import type { PlatformInfo } from '../types';
import { SettingsSection } from './SettingsSection';

interface AboutSectionProps {
  platform: PlatformInfo;
  className?: string;
}

export function AboutSection({ platform, className }: AboutSectionProps) {
  const getEnvironmentBadge = (env: PlatformInfo['environment']) => {
    const styles: Record<PlatformInfo['environment'], string> = {
      development: 'bg-yellow-100 text-yellow-700',
      staging: 'bg-blue-100 text-blue-700',
      production: 'bg-green-100 text-green-700',
    };
    return styles[env];
  };

  return (
    <SettingsSection title="About" className={className}>
      <div className="space-y-3">
        {/* Platform */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <span className="text-sm font-medium text-gray-500">Platform</span>
          <span className="text-sm font-semibold text-gray-900">{platform.name}</span>
        </div>

        {/* Version */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <span className="text-sm font-medium text-gray-500">Version</span>
          <code className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
            {platform.version}
          </code>
        </div>

        {/* Environment */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <span className="text-sm font-medium text-gray-500">Environment</span>
          <span
            className={clsx(
              'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
              getEnvironmentBadge(platform.environment)
            )}
          >
            {platform.environment}
          </span>
        </div>

        {/* API Endpoint */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <span className="text-sm font-medium text-gray-500">API Endpoint</span>
          <code className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
            {platform.apiEndpoint}
          </code>
        </div>

        {/* Links */}
        <div className="flex flex-wrap gap-3 pt-2">
          <a
            href={platform.documentationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Book className="h-4 w-4" />
            Documentation
          </a>
          <a
            href={platform.supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <MessageCircle className="h-4 w-4" />
            Support
          </a>
          <a
            href={platform.changelogUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <FileText className="h-4 w-4" />
            Changelog
          </a>
        </div>
      </div>
    </SettingsSection>
  );
}
