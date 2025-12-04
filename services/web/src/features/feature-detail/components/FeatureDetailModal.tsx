import clsx from 'clsx';
import { X, Loader2 } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import {
  useFeatureDetail,
  useFeatureRequirements,
  useFeatureQuestions,
  useFeatureHistory,
  useFeatureActions,
} from '../hooks';
import type { FeatureDetailTab } from '../types';
import { ActionButtons } from './ActionButtons';
import { getStatusLabel, getStatusColor } from './helpers';
import { HistoryTab } from './HistoryTab';
import { OverviewTab } from './OverviewTab';
import { QuestionsTab } from './QuestionsTab';
import { RequirementsTab } from './RequirementsTab';
import { TabNavigation } from './TabNavigation';
import { Button } from '@/components/ui';

interface FeatureDetailModalProps {
  featureId: string;
  onClose: () => void;
}

export function FeatureDetailModal({ featureId, onClose }: FeatureDetailModalProps) {
  const [activeTab, setActiveTab] = useState<FeatureDetailTab>('overview');
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | undefined>();

  // Fetch data
  const {
    data: feature,
    isLoading: featureLoading,
    error: featureError,
  } = useFeatureDetail(featureId);
  const { data: requirements, isLoading: requirementsLoading } = useFeatureRequirements(featureId);
  const { data: questions, isLoading: questionsLoading } = useFeatureQuestions(featureId);
  const { data: history, isLoading: historyLoading } = useFeatureHistory(featureId);

  // Actions
  const {
    approve,
    isApproving,
    startLoop,
    isStartingLoop,
    updatePriority,
    isUpdatingPriority,
    answerQuestion,
    isAnsweringQuestion,
  } = useFeatureActions(featureId);

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const handleAnswerQuestion = (questionId: string, answer: string) => {
    setAnsweringQuestionId(questionId);
    answerQuestion(
      { questionId, answer },
      {
        onSettled: () => setAnsweringQuestionId(undefined),
      }
    );
  };

  // Loading state
  if (featureLoading) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-8 text-center dark:bg-gray-800">
            <Loader2 className="text-primary-500 mx-auto mb-4 h-8 w-8 animate-spin" />
            <p className="text-gray-500 dark:text-gray-400">Loading feature details...</p>
          </div>
        </div>
      </>
    );
  }

  // Error state
  if (featureError || !feature) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-8 text-center dark:bg-gray-800">
            <p className="mb-4 text-red-600 dark:text-red-400">
              {featureError instanceof Error ? featureError.message : 'Failed to load feature'}
            </p>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 transition-opacity" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-6">
        <div
          className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-3">
                <span className="font-mono text-sm text-gray-400 dark:text-gray-500">
                  {feature.id.toUpperCase()}
                </span>
                <span
                  className={clsx(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    getStatusColor(feature.status)
                  )}
                >
                  {getStatusLabel(feature.status)}
                </span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {feature.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="ml-4 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <TabNavigation
            activeTab={activeTab}
            onTabChange={setActiveTab}
            requirementCount={requirements?.length || feature.requirementCount}
            questionCount={questions?.length || feature.questionCount}
          />

          {/* Tab Content */}
          <div className="max-h-[calc(90vh-250px)] overflow-y-auto">
            {activeTab === 'overview' && <OverviewTab feature={feature} />}
            {activeTab === 'requirements' && (
              <RequirementsTab requirements={requirements || []} isLoading={requirementsLoading} />
            )}
            {activeTab === 'questions' && (
              <QuestionsTab
                questions={questions || []}
                onAnswer={handleAnswerQuestion}
                isAnswering={isAnsweringQuestion}
                answeringQuestionId={answeringQuestionId}
                isLoading={questionsLoading}
              />
            )}
            {activeTab === 'history' && (
              <HistoryTab history={history || []} isLoading={historyLoading} />
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
            <ActionButtons
              feature={feature}
              onApprove={approve}
              onStartLoop={startLoop}
              onUpdatePriority={updatePriority}
              isApproving={isApproving}
              isStartingLoop={isStartingLoop}
              isUpdatingPriority={isUpdatingPriority}
            />
          </div>
        </div>
      </div>
    </>
  );
}
