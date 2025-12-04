import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitAnswer } from '../api/decompositionApi';
import type { DecompositionResult } from '../types';

export function useAnswerQuestion(requirementId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ questionId, answer }: { questionId: string; answer: string }) =>
      submitAnswer(questionId, answer),
    onSuccess: (data, variables) => {
      // Update the decomposition result with answered question
      queryClient.setQueryData<DecompositionResult>(
        ['decomposition-result', requirementId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            clarificationQuestions: old.clarificationQuestions.map((q) =>
              q.id === variables.questionId
                ? {
                    ...q,
                    answered: true,
                    answer: variables.answer,
                    answeredAt: new Date().toISOString(),
                  }
                : q
            ),
            // Update feature readiness if returned
            featureCandidates: data.updatedFeature
              ? old.featureCandidates.map((f) =>
                  f.id === data.updatedFeature!.id
                    ? { ...f, readinessScore: data.updatedFeature!.readinessScore }
                    : f
                )
              : old.featureCandidates,
            // Update summary blocking questions count
            summary: {
              ...old.summary,
              blockingQuestions: old.clarificationQuestions.filter(
                (q) => q.impact === 'blocking' && !q.answered && q.id !== variables.questionId
              ).length,
            },
          };
        }
      );

      // Also invalidate to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['decomposition-result', requirementId] });
    },
  });
}
