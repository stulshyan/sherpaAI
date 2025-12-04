import clsx from 'clsx';
import { AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';
import type { ClarificationQuestion } from '../types';
import { QuestionCard } from './QuestionCard';

interface QuestionsSectionProps {
  questions: ClarificationQuestion[];
  onAnswer: (questionId: string, answer: string) => void;
  answeringQuestionId?: string;
  className?: string;
}

export function QuestionsSection({
  questions,
  onAnswer,
  answeringQuestionId,
  className,
}: QuestionsSectionProps) {
  // Sort blocking questions first, then unanswered, then answered
  const sortedQuestions = useMemo(() => {
    return [...questions].sort((a, b) => {
      // Unanswered blocking first
      if (!a.answered && a.impact === 'blocking' && !(!b.answered && b.impact === 'blocking')) return -1;
      if (!b.answered && b.impact === 'blocking' && !(!a.answered && a.impact === 'blocking')) return 1;
      // Then unanswered
      if (!a.answered && b.answered) return -1;
      if (a.answered && !b.answered) return 1;
      return 0;
    });
  }, [questions]);

  const blockingCount = questions.filter((q) => q.impact === 'blocking' && !q.answered).length;
  const unansweredCount = questions.filter((q) => !q.answered).length;

  return (
    <div className={clsx('space-y-4', className)}>
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Clarification Questions
        </h3>
        {blockingCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            {blockingCount} blocking
          </span>
        )}
        {unansweredCount > 0 && unansweredCount !== blockingCount && (
          <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-sm text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            {unansweredCount} unanswered
          </span>
        )}
      </div>

      <div className="space-y-3">
        {sortedQuestions.map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            onAnswer={(answer) => onAnswer(question.id, answer)}
            isAnswering={answeringQuestionId === question.id}
          />
        ))}

        {questions.length === 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center dark:border-gray-700 dark:bg-gray-800/50">
            <p className="text-gray-500 dark:text-gray-400">
              No clarification questions needed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
