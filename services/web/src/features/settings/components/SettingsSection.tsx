import clsx from 'clsx';
import type { ReactNode } from 'react';

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
}

export function SettingsSection({
  title,
  description,
  children,
  className,
  headerAction,
}: SettingsSectionProps) {
  return (
    <div className={clsx('rounded-lg border border-gray-200 bg-white p-6', className)}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
        {headerAction && <div>{headerAction}</div>}
      </div>
      {children}
    </div>
  );
}
