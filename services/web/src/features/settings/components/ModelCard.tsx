import clsx from 'clsx';
import { Bot, Info } from 'lucide-react';
import { useState } from 'react';
import type { ModelAssignment } from '../types';
import {
  formatContextWindow,
  formatCost,
  getStatusLabel,
  PROVIDER_CONFIG,
  STATUS_CONFIG,
} from '../types';
import { Button } from '@/components/ui';

interface ModelCardProps {
  assignment: ModelAssignment;
  className?: string;
}

export function ModelCard({ assignment, className }: ModelCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const statusConfig = STATUS_CONFIG[assignment.status];
  const providerConfig = PROVIDER_CONFIG[assignment.model.provider];

  return (
    <div
      className={clsx(
        'relative rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm',
        className
      )}
    >
      {/* Agent Name */}
      <h3 className="mb-3 text-sm font-semibold text-gray-900">{assignment.agentName}</h3>

      {/* Model Info */}
      <div
        className="relative mb-3 flex items-center gap-2"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Bot className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">{assignment.model.name}</span>
        <Info className="h-3 w-3 cursor-help text-gray-400" />

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute left-0 top-full z-10 mt-1 w-56 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Full Name</span>
                <span className="font-medium text-gray-900">{assignment.model.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Context Window</span>
                <span className="font-medium text-gray-900">
                  {formatContextWindow(assignment.model.contextWindow)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Input Cost</span>
                <span className="font-medium text-gray-900">
                  {formatCost(assignment.model.costPer1kInput)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Output Cost</span>
                <span className="font-medium text-gray-900">
                  {formatCost(assignment.model.costPer1kOutput)}
                </span>
              </div>
              {assignment.totalExecutions !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Executions</span>
                  <span className="font-medium text-gray-900">{assignment.totalExecutions}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Provider */}
      <div className="mb-3">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: providerConfig.bgColor, color: providerConfig.color }}
        >
          {providerConfig.name}
        </span>
      </div>

      {/* Status */}
      <div className="mb-3 flex items-center gap-1">
        <span className={clsx('text-sm', statusConfig.text)}>
          {statusConfig.icon} {getStatusLabel(assignment.status)}
        </span>
      </div>

      {/* Change Button (disabled for MVP) */}
      <Button
        variant="secondary"
        size="sm"
        disabled
        className="w-full opacity-50"
        title="Contact admin to change models"
      >
        Change
      </Button>
    </div>
  );
}
