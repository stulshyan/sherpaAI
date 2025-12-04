import { ArrowLeft, ArrowRight, CheckCircle, File, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui';
import {
  useDecompositionStatus,
  useDecompositionResult,
  useAnswerQuestion,
  ProcessingProgress,
  DecompositionSummaryCard,
  ThemesSection,
  FeaturesSection,
  QuestionsSection,
} from '@/features/decomposition';
import { FeatureDetailModal } from '@/features/feature-detail';

export default function DecompositionPage() {
  const { requirementId } = useParams<{ requirementId: string }>();
  const navigate = useNavigate();
  const [selectedThemeId, setSelectedThemeId] = useState<string | undefined>();
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | undefined>();
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | undefined>();

  // Fetch decomposition status (with polling)
  const {
    data: status,
    isLoading: statusLoading,
    error: statusError,
  } = useDecompositionStatus(requirementId);

  // Fetch decomposition result (only when status is completed)
  const isCompleted = status?.status === 'completed';
  const {
    data: result,
    isLoading: resultLoading,
    error: resultError,
  } = useDecompositionResult(requirementId, isCompleted);

  // Answer question mutation
  const answerMutation = useAnswerQuestion(requirementId || '');

  const handleAnswerQuestion = (questionId: string, answer: string) => {
    setAnsweringQuestionId(questionId);
    answerMutation.mutate(
      { questionId, answer },
      {
        onSettled: () => setAnsweringQuestionId(undefined),
      }
    );
  };

  const handleFeatureClick = (featureId: string) => {
    setSelectedFeatureId(featureId);
  };

  const handleRecommendedClick = () => {
    if (result?.summary.recommendedFirstFeature) {
      setSelectedFeatureId(result.summary.recommendedFirstFeature.id);
    }
  };

  // Loading state
  if (statusLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="text-primary-500 mx-auto mb-4 h-8 w-8 animate-spin" />
          <p className="text-gray-500 dark:text-gray-400">Loading decomposition...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (statusError || resultError) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-900/20">
          <p className="text-red-700 dark:text-red-400">
            {statusError instanceof Error
              ? statusError.message
              : resultError instanceof Error
                ? resultError.message
                : 'Failed to load decomposition'}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/intake')}>
            Back to Intake Hub
          </Button>
        </div>
      </div>
    );
  }

  const isProcessing = status && !['completed', 'failed'].includes(status.status);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/intake"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Intake Hub</span>
          </Link>
        </div>

        {isCompleted && (
          <Button
            variant="primary"
            onClick={() => navigate('/backlog')}
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            View in Backlog
          </Button>
        )}
      </div>

      {/* Document Info */}
      <div className="mb-6 flex items-center gap-3">
        <File className="h-6 w-6 text-gray-400 dark:text-gray-500" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Requirement Decomposition
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            ID: {requirementId?.toUpperCase()}
          </p>
        </div>
        {isCompleted && (
          <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            Decomposition Complete
          </span>
        )}
      </div>

      {/* Processing State */}
      {isProcessing && status && (
        <ProcessingProgress
          status={status}
          onRetry={() => {
            // TODO: Implement retry functionality
          }}
        />
      )}

      {/* Failed State */}
      {status?.status === 'failed' && (
        <ProcessingProgress
          status={status}
          onRetry={() => {
            // TODO: Implement retry functionality
          }}
        />
      )}

      {/* Results State */}
      {isCompleted && result && (
        <div className="space-y-8">
          {/* Summary */}
          <DecompositionSummaryCard
            summary={result.summary}
            onRecommendedClick={handleRecommendedClick}
          />

          {/* Themes */}
          <ThemesSection
            themes={result.themes}
            selectedThemeId={selectedThemeId}
            onSelectTheme={setSelectedThemeId}
          />

          {/* Features */}
          <FeaturesSection
            features={result.featureCandidates}
            themes={result.themes}
            selectedThemeId={selectedThemeId}
            onFeatureClick={handleFeatureClick}
          />

          {/* Questions */}
          {result.clarificationQuestions.length > 0 && (
            <QuestionsSection
              questions={result.clarificationQuestions}
              onAnswer={handleAnswerQuestion}
              answeringQuestionId={answeringQuestionId}
            />
          )}
        </div>
      )}

      {/* Results Loading */}
      {isCompleted && resultLoading && (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="text-primary-500 h-8 w-8 animate-spin" />
        </div>
      )}

      {/* Feature Detail Modal */}
      {selectedFeatureId && (
        <FeatureDetailModal
          featureId={selectedFeatureId}
          onClose={() => setSelectedFeatureId(undefined)}
        />
      )}
    </div>
  );
}
