import clsx from 'clsx';
import { AlertTriangle, Check, MessageCircle } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Button, Input } from '@/components/ui';
import type { FeatureQuestion } from '../types';
import { formatRelativeTime } from './helpers';

interface QuestionsTabProps {
  questions: FeatureQuestion[];
  onAnswer: (questionId: string, answer: string) => void;
  isAnswering?: boolean;
  answeringQuestionId?: string;
  isLoading?: boolean;
}

type QuestionFilter = 'all' | 'unanswered' | 'blocking';

export function QuestionsTab({
  questions,
  onAnswer,
  isAnswering,
  answeringQuestionId,
  isLoading,
}: QuestionsTabProps) {
  const [filter, setFilter] = useState<QuestionFilter>('all');

  const filteredQuestions = useMemo(() => {
    let filtered = [...questions];
    if (filter === 'unanswered') {
      filtered = filtered.filter((q) => !q.answered);
    } else if (filter === 'blocking') {
      filtered = filtered.filter((q) => q.impact === 'blocking' && !q.answered);
    }
    // Sort: blocking unanswered first, then unanswered, then answered
    return filtered.sort((a, b) => {
      if (!a.answered && a.impact === 'blocking' && !(!b.answered && b.impact === 'blocking')) return -1;
      if (!b.answered && b.impact === 'blocking' && !(!a.answered && a.impact === 'blocking')) return 1;
      if (!a.answered && b.answered) return -1;
      if (a.answered && !b.answered) return 1;
      return 0;
    });
  }, [questions, filter]);

  const counts = useMemo(() => ({
    all: questions.length,
    unanswered: questions.filter((q) => !q.answered).length,
    blocking: questions.filter((q) => q.impact === 'blocking' && !q.answered).length,
  }), [questions]);

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="p-8 text-center">
        <MessageCircle className="mx-auto mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
        <p className="text-gray-500 dark:text-gray-400">No questions for this feature.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'unanswered', 'blocking'] as QuestionFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'rounded-full px-3 py-1 text-sm font-medium transition-colors',
              filter === f
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
            )}
          >
            {f === 'all' ? 'All' : f === 'unanswered' ? 'Unanswered' : 'Blocking'}
            <span className="ml-1 text-xs">({counts[f]})</span>
          </button>
        ))}
      </div>

      {/* Questions List */}
      <div className="space-y-3">
        {filteredQuestions.map((question) => (
          <QuestionItem
            key={question.id}
            question={question}
            onAnswer={(answer) => onAnswer(question.id, answer)}
            isAnswering={answeringQuestionId === question.id && isAnswering}
          />
        ))}

        {filteredQuestions.length === 0 && (
          <div className="py-6 text-center text-gray-500 dark:text-gray-400">
            No {filter === 'all' ? '' : filter} questions.
          </div>
        )}
      </div>
    </div>
  );
}

interface QuestionItemProps {
  question: FeatureQuestion;
  onAnswer: (answer: string) => void;
  isAnswering?: boolean;
}

function QuestionItem({ question, onAnswer, isAnswering }: QuestionItemProps) {
  const [answer, setAnswer] = useState(question.answer || '');
  const isBlocking = question.impact === 'blocking' && !question.answered;

  const handleSubmit = () => {
    if (answer.trim()) {
      onAnswer(answer.trim());
    }
  };

  return (
    <div
      className={clsx(
        'rounded-lg border p-4',
        isBlocking
          ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
      )}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        {question.impact === 'blocking' && !question.answered && (
          <AlertTriangle className="h-4 w-4 text-red-500" />
        )}
        <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
          {question.id.toUpperCase()}
        </span>
        <span className={clsx(
          'rounded-full px-2 py-0.5 text-xs font-medium',
          question.impact === 'blocking'
            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            : question.impact === 'clarifying'
            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
        )}>
          {question.impact}
        </span>
      </div>

      {/* Question */}
      <p className="mb-3 font-medium text-gray-900 dark:text-white">{question.question}</p>

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
      ) : question.questionType === 'yes_no' ? (
        <div className="flex gap-2">
          <Button
            variant={answer === 'Yes' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              setAnswer('Yes');
              onAnswer('Yes');
            }}
            disabled={isAnswering}
            loading={isAnswering && answer === 'Yes'}
          >
            Yes
          </Button>
          <Button
            variant={answer === 'No' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              setAnswer('No');
              onAnswer('No');
            }}
            disabled={isAnswering}
            loading={isAnswering && answer === 'No'}
          >
            No
          </Button>
        </div>
      ) : question.questionType === 'multiple_choice' && question.options ? (
        <div className="space-y-2">
          {question.options.map((option, index) => (
            <label
              key={index}
              className={clsx(
                'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all',
                answer === option
                  ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/30'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
              )}
            >
              <input
                type="radio"
                name={`answer-${question.id}`}
                value={option}
                checked={answer === option}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={isAnswering}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
            </label>
          ))}
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!answer || isAnswering}
            loading={isAnswering}
          >
            Submit Answer
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            placeholder="Type your answer..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={isAnswering}
            className="flex-1"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!answer.trim() || isAnswering}
            loading={isAnswering}
          >
            Submit
          </Button>
        </div>
      )}
    </div>
  );
}
