import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  approveFeature,
  startLoop,
  updatePriority,
  answerFeatureQuestion,
} from '../api/featureDetailApi';
import type { FeatureQuestion } from '../types';

export function useFeatureActions(featureId: string) {
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: () => approveFeature(featureId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature', featureId] });
      queryClient.invalidateQueries({ queryKey: ['backlog'] });
      queryClient.invalidateQueries({ queryKey: ['backlog-summary'] });
    },
  });

  const startLoopMutation = useMutation({
    mutationFn: (loop: 'A' | 'B' | 'C') => startLoop(featureId, loop),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature', featureId] });
      queryClient.invalidateQueries({ queryKey: ['backlog'] });
      queryClient.invalidateQueries({ queryKey: ['backlog-summary'] });
    },
  });

  const updatePriorityMutation = useMutation({
    mutationFn: (priority: number) => updatePriority(featureId, priority),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature', featureId] });
      queryClient.invalidateQueries({ queryKey: ['backlog'] });
      queryClient.invalidateQueries({ queryKey: ['backlog-summary'] });
    },
  });

  const answerQuestionMutation = useMutation({
    mutationFn: ({ questionId, answer }: { questionId: string; answer: string }) =>
      answerFeatureQuestion(questionId, answer),
    onSuccess: (_data, variables) => {
      // Update questions cache optimistically
      queryClient.setQueryData<FeatureQuestion[]>(
        ['feature-questions', featureId],
        (old) => {
          if (!old) return old;
          return old.map((q) =>
            q.id === variables.questionId
              ? {
                  ...q,
                  answered: true,
                  answer: variables.answer,
                  answeredAt: new Date().toISOString(),
                }
              : q
          );
        }
      );
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['feature', featureId] });
      queryClient.invalidateQueries({ queryKey: ['feature-questions', featureId] });
      queryClient.invalidateQueries({ queryKey: ['feature-history', featureId] });
    },
  });

  return {
    approve: approveMutation.mutate,
    isApproving: approveMutation.isPending,
    approveError: approveMutation.error,

    startLoop: startLoopMutation.mutate,
    isStartingLoop: startLoopMutation.isPending,
    startLoopError: startLoopMutation.error,

    updatePriority: updatePriorityMutation.mutate,
    isUpdatingPriority: updatePriorityMutation.isPending,
    updatePriorityError: updatePriorityMutation.error,

    answerQuestion: answerQuestionMutation.mutate,
    isAnsweringQuestion: answerQuestionMutation.isPending,
    answerQuestionError: answerQuestionMutation.error,
  };
}
