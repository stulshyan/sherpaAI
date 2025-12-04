import { useState } from 'react';
import { CheckCircle, Play, Edit2, AlertTriangle } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import type { FeatureDetail } from '../types';

interface ActionButtonsProps {
  feature: FeatureDetail;
  onApprove: () => void;
  onStartLoop: (loop: 'A' | 'B' | 'C') => void;
  onUpdatePriority: (priority: number) => void;
  isApproving?: boolean;
  isStartingLoop?: boolean;
  isUpdatingPriority?: boolean;
}

export function ActionButtons({
  feature,
  onApprove,
  onStartLoop,
  onUpdatePriority,
  isApproving,
  isStartingLoop,
  isUpdatingPriority,
}: ActionButtonsProps) {
  const [isEditingPriority, setIsEditingPriority] = useState(false);
  const [priorityValue, setPriorityValue] = useState(feature.priorityScore.toFixed(2));

  const canApprove =
    feature.status === 'backlog' &&
    feature.readinessScore >= 0.8 &&
    feature.blockingQuestionCount === 0;

  const isApproved = feature.status === 'approved';
  const isInLoop = feature.currentLoop !== undefined;

  const getApproveTooltip = () => {
    if (feature.status !== 'backlog') return 'Feature must be in backlog';
    if (feature.readinessScore < 0.8) return 'Readiness must be >= 80%';
    if (feature.blockingQuestionCount > 0)
      return `${feature.blockingQuestionCount} blocking question(s) must be answered`;
    return '';
  };

  const handlePrioritySave = () => {
    const value = parseFloat(priorityValue);
    if (!isNaN(value) && value >= 0 && value <= 1) {
      onUpdatePriority(value);
      setIsEditingPriority(false);
    }
  };

  const handlePriorityCancel = () => {
    setPriorityValue(feature.priorityScore.toFixed(2));
    setIsEditingPriority(false);
  };

  return (
    <div className="space-y-4">
      {/* Warning Messages */}
      {!canApprove && feature.status === 'backlog' && (
        <div className="flex items-start gap-2 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{getApproveTooltip()}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Approve Button */}
        {!isApproved && !isInLoop && (
          <Button
            variant="primary"
            onClick={onApprove}
            disabled={!canApprove || isApproving}
            loading={isApproving}
            leftIcon={<CheckCircle className="h-4 w-4" />}
            title={canApprove ? '' : getApproveTooltip()}
          >
            Approve for Loop A
          </Button>
        )}

        {/* Start Loop Button */}
        {isApproved && !isInLoop && (
          <Button
            variant="primary"
            onClick={() => onStartLoop('A')}
            disabled={isStartingLoop}
            loading={isStartingLoop}
            leftIcon={<Play className="h-4 w-4" />}
          >
            Start Loop A
          </Button>
        )}

        {/* Loop Status */}
        {isInLoop && (
          <div className="flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <Play className="h-4 w-4" />
            Loop {feature.currentLoop} in progress ({feature.loopProgress || 0}%)
          </div>
        )}

        {/* Edit Priority */}
        {!isEditingPriority ? (
          <Button
            variant="outline"
            onClick={() => setIsEditingPriority(true)}
            leftIcon={<Edit2 className="h-4 w-4" />}
          >
            Edit Priority
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={priorityValue}
              onChange={(e) => setPriorityValue(e.target.value)}
              className="w-24"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handlePrioritySave}
              loading={isUpdatingPriority}
            >
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={handlePriorityCancel}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
