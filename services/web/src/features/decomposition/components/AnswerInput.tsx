import clsx from 'clsx';
import { useState, useEffect } from 'react';
import { Button, Input } from '@/components/ui';
import type { QuestionType } from '../types';

interface AnswerInputProps {
  questionType: QuestionType;
  options?: string[];
  defaultAnswer?: string;
  currentAnswer?: string;
  onSubmit: (answer: string) => void;
  isSubmitting?: boolean;
}

export function AnswerInput({
  questionType,
  options,
  defaultAnswer,
  currentAnswer,
  onSubmit,
  isSubmitting,
}: AnswerInputProps) {
  const [answer, setAnswer] = useState(currentAnswer || defaultAnswer || '');
  const isAnswered = !!currentAnswer;

  useEffect(() => {
    if (currentAnswer) {
      setAnswer(currentAnswer);
    }
  }, [currentAnswer]);

  const handleSubmit = () => {
    if (answer.trim()) {
      onSubmit(answer.trim());
    }
  };

  // Multiple Choice
  if (questionType === 'multiple_choice' && options) {
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          {options.map((option, index) => (
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
                name="answer"
                value={option}
                checked={answer === option}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={isSubmitting}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
            </label>
          ))}
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={!answer || isSubmitting}
          loading={isSubmitting}
        >
          {isAnswered ? 'Update Answer' : 'Submit Answer'}
        </Button>
      </div>
    );
  }

  // Yes/No
  if (questionType === 'yes_no') {
    return (
      <div className="flex gap-3">
        <Button
          variant={answer === 'Yes' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => {
            setAnswer('Yes');
            onSubmit('Yes');
          }}
          disabled={isSubmitting}
          loading={isSubmitting && answer === 'Yes'}
        >
          Yes
        </Button>
        <Button
          variant={answer === 'No' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => {
            setAnswer('No');
            onSubmit('No');
          }}
          disabled={isSubmitting}
          loading={isSubmitting && answer === 'No'}
        >
          No
        </Button>
      </div>
    );
  }

  // Text or Dropdown (default to text input)
  return (
    <div className="flex gap-3">
      <div className="flex-1">
        <Input
          placeholder="Type your answer..."
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={isSubmitting}
        />
      </div>
      <Button
        variant="primary"
        size="sm"
        onClick={handleSubmit}
        disabled={!answer.trim() || isSubmitting}
        loading={isSubmitting}
      >
        {isAnswered ? 'Update' : 'Submit'}
      </Button>
    </div>
  );
}
