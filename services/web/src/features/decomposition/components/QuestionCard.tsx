import clsx from 'clsx';
import { AlertTriangle, Check, MessageCircle } from 'lucide-react';
import type { ClarificationQuestion } from '../types';
import { AnswerInput } from './AnswerInput';

interface QuestionCardProps {
  question: ClarificationQuestion;
  onAnswer: (answer: string) => void;
  isAnswering?: boolean;
}

function getImpactBadge(impact: ClarificationQuestion['impact']) {
  const config = {
    blocking: {
      icon: AlertTriangle,
      color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      label: 'Blocking',
    },
    clarifying: {
      icon: MessageCircle,
      color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      label: 'Clarifying',
    },
    optional: {
      icon: MessageCircle,
      color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
      label: 'Optional',
    },
  };
  return config[impact] || config.clarifying;
}

function getCategoryLabel(category: ClarificationQuestion['category']) {
  const labels: Record<string, string> = {
    business: 'Business',
    technical: 'Technical',
    compliance: 'Compliance',
    scope: 'Scope',
  };
  return labels[category] || category;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function QuestionCard({ question, onAnswer, isAnswering }: QuestionCardProps) {
  const isBlocking = question.impact === 'blocking';
  const impactBadge = getImpactBadge(question.impact);
  const ImpactIcon = impactBadge.icon;

  return (
    <div
      className={clsx(
        'rounded-lg border p-4',
        isBlocking && !question.answered
          ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
      )}
    >
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* Question ID */}
        <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
          {question.id.toUpperCase()}
        </span>

        {/* Impact Badge */}
        <span className={clsx('flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', impactBadge.color)}>
          <ImpactIcon className="h-3 w-3" />
          {impactBadge.label}
        </span>

        {/* Category Badge */}
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
          {getCategoryLabel(question.category)}
        </span>

        {/* Feature ID */}
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Feature: {question.featureId.toUpperCase()}
        </span>
      </div>

      {/* Question */}
      <p className="mb-4 font-medium text-gray-900 dark:text-white">{question.question}</p>

      {/* Answer Section */}
      {question.answered ? (
        <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
          <div className="mb-1 flex items-center gap-2 text-green-700 dark:text-green-400">
            <Check className="h-4 w-4" />
            <span className="text-sm font-medium">Answered</span>
            {question.answeredAt && (
              <span className="text-xs text-green-600 dark:text-green-500">
                {formatRelativeTime(question.answeredAt)}
              </span>
            )}
          </div>
          <p className="text-sm text-green-800 dark:text-green-300">{question.answer}</p>
        </div>
      ) : (
        <AnswerInput
          questionType={question.questionType}
          options={question.options}
          defaultAnswer={question.defaultAnswer}
          currentAnswer={question.answer}
          onSubmit={onAnswer}
          isSubmitting={isAnswering}
        />
      )}
    </div>
  );
}
