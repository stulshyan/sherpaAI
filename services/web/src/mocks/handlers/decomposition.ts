import { http, HttpResponse, delay } from 'msw';

interface DecompositionProgress {
  requirementId: string;
  progress: number;
  stage: string;
  startedAt: string;
}

// Track decomposition progress per requirement
const decompositionProgress = new Map<string, DecompositionProgress>();

// Initialize some mock progress
decompositionProgress.set('req-001', {
  requirementId: 'req-001',
  progress: 100,
  stage: 'completed',
  startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
});

decompositionProgress.set('req-002', {
  requirementId: 'req-002',
  progress: 100,
  stage: 'completed',
  startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
});

// Mock decomposition result data
const mockDecompositionResult = {
  requirementId: 'req-001',
  version: 1,
  themes: [
    {
      id: 'th-001',
      label: 'User Authentication',
      confidence: 0.92,
      domain: 'Security',
      description: 'User login, registration, and session management',
      relatedFeatures: ['f-001', 'f-002'],
      color: '#3B82F6',
    },
    {
      id: 'th-002',
      label: 'Product Catalog',
      confidence: 0.88,
      domain: 'Commerce',
      description: 'Product listing, search, and details',
      relatedFeatures: ['f-003', 'f-004'],
      color: '#10B981',
    },
    {
      id: 'th-003',
      label: 'Shopping Cart',
      confidence: 0.85,
      domain: 'Commerce',
      description: 'Cart management and checkout flow',
      relatedFeatures: ['f-005'],
      color: '#F59E0B',
    },
    {
      id: 'th-004',
      label: 'Payments',
      confidence: 0.82,
      domain: 'Finance',
      description: 'Payment processing and refunds',
      relatedFeatures: ['f-006'],
      color: '#8B5CF6',
    },
  ],
  featureCandidates: [
    {
      id: 'f-001',
      title: 'User Registration',
      description: 'Allow users to create accounts with email and password',
      themeIds: ['th-001'],
      childRequirements: ['ar-001', 'ar-002', 'ar-003'],
      estimatedComplexity: 'medium',
      readinessScore: 0.85,
      suggestedPriority: 9,
      tags: ['auth', 'mvp'],
      pendingQuestions: 0,
    },
    {
      id: 'f-002',
      title: 'User Login',
      description: 'Secure authentication with email/password and OAuth',
      themeIds: ['th-001'],
      childRequirements: ['ar-004', 'ar-005'],
      estimatedComplexity: 'medium',
      readinessScore: 0.9,
      suggestedPriority: 10,
      tags: ['auth', 'mvp'],
      pendingQuestions: 0,
    },
    {
      id: 'f-003',
      title: 'Product Listing',
      description: 'Display products with filtering, sorting, and pagination',
      themeIds: ['th-002'],
      childRequirements: ['ar-006', 'ar-007', 'ar-008'],
      estimatedComplexity: 'high',
      readinessScore: 0.72,
      suggestedPriority: 8,
      tags: ['catalog'],
      pendingQuestions: 1,
    },
    {
      id: 'f-004',
      title: 'Product Search',
      description: 'Full-text search across products with autocomplete',
      themeIds: ['th-002'],
      childRequirements: ['ar-009', 'ar-010'],
      estimatedComplexity: 'high',
      readinessScore: 0.65,
      suggestedPriority: 7,
      tags: ['catalog', 'search'],
      pendingQuestions: 1,
    },
    {
      id: 'f-005',
      title: 'Shopping Cart',
      description: 'Add/remove items, adjust quantities, view totals',
      themeIds: ['th-003'],
      childRequirements: ['ar-011', 'ar-012', 'ar-013'],
      estimatedComplexity: 'medium',
      readinessScore: 0.78,
      suggestedPriority: 8,
      tags: ['cart', 'mvp'],
      pendingQuestions: 0,
    },
    {
      id: 'f-006',
      title: 'Payment Processing',
      description: 'Process payments via multiple providers',
      themeIds: ['th-004'],
      childRequirements: ['ar-014', 'ar-015'],
      estimatedComplexity: 'very_high',
      readinessScore: 0.55,
      suggestedPriority: 6,
      tags: ['payments'],
      pendingQuestions: 2,
    },
  ],
  atomicRequirements: [
    {
      id: 'ar-001',
      themeId: 'th-001',
      featureId: 'f-001',
      text: 'Users can register with email and password',
      clarity: 0.9,
      testable: true,
      dependencies: [],
    },
    {
      id: 'ar-002',
      themeId: 'th-001',
      featureId: 'f-001',
      text: 'Email verification required before account activation',
      clarity: 0.85,
      testable: true,
      dependencies: ['ar-001'],
    },
    {
      id: 'ar-003',
      themeId: 'th-001',
      featureId: 'f-001',
      text: 'Password must meet security requirements (8+ chars, mixed case, number)',
      clarity: 0.92,
      testable: true,
      dependencies: [],
    },
    {
      id: 'ar-004',
      themeId: 'th-001',
      featureId: 'f-002',
      text: 'Users can log in with email and password',
      clarity: 0.95,
      testable: true,
      dependencies: ['ar-001'],
    },
    {
      id: 'ar-005',
      themeId: 'th-001',
      featureId: 'f-002',
      text: 'Support OAuth login with Google and GitHub',
      clarity: 0.78,
      testable: true,
      dependencies: [],
    },
  ],
  clarificationQuestions: [
    {
      id: 'q-001',
      featureId: 'f-006',
      question: 'Which payment providers should be supported?',
      questionType: 'multiple_choice',
      options: [
        'Stripe only',
        'Stripe + PayPal',
        'Stripe + PayPal + Apple Pay',
        'Custom selection',
      ],
      impact: 'blocking',
      category: 'business',
      answered: false,
      answer: undefined as string | undefined,
      answeredAt: undefined as string | undefined,
    },
    {
      id: 'q-002',
      featureId: 'f-006',
      question: 'Should we support recurring payments/subscriptions?',
      questionType: 'yes_no',
      options: undefined as string[] | undefined,
      impact: 'blocking',
      category: 'scope',
      answered: false,
      answer: undefined as string | undefined,
      answeredAt: undefined as string | undefined,
    },
    {
      id: 'q-003',
      featureId: 'f-003',
      question: 'How many products will the initial catalog contain?',
      questionType: 'text',
      options: undefined as string[] | undefined,
      impact: 'clarifying',
      category: 'scope',
      answered: false,
      answer: undefined as string | undefined,
      answeredAt: undefined as string | undefined,
    },
    {
      id: 'q-004',
      featureId: 'f-004',
      question: 'Should search include fuzzy matching for typos?',
      questionType: 'yes_no',
      options: undefined as string[] | undefined,
      impact: 'clarifying',
      category: 'technical',
      answered: false,
      answer: undefined as string | undefined,
      answeredAt: undefined as string | undefined,
    },
  ],
  summary: {
    totalThemes: 4,
    totalFeatures: 6,
    totalAtomicRequirements: 5,
    totalQuestions: 4,
    blockingQuestions: 2,
    averageClarity: 0.78,
    estimatedComplexity: 'high',
    recommendedFirstFeature: { id: 'f-002', title: 'User Login' },
  },
  decomposedAt: new Date().toISOString(),
};

// Helper to simulate progress
function simulateProgress(requirementId: string) {
  const progress = decompositionProgress.get(requirementId);
  if (!progress || progress.progress >= 100) return;

  const stages = [
    { stage: 'extracting', max: 25 },
    { stage: 'classifying', max: 40 },
    { stage: 'decomposing', max: 85 },
    { stage: 'scoring', max: 95 },
    { stage: 'completed', max: 100 },
  ];

  progress.progress += Math.floor(Math.random() * 10) + 5;

  for (const s of stages) {
    if (progress.progress <= s.max) {
      progress.stage = s.stage;
      break;
    }
  }

  if (progress.progress >= 100) {
    progress.progress = 100;
    progress.stage = 'completed';
  }
}

export const decompositionHandlers = [
  // Get decomposition status (polling endpoint)
  http.get('/api/v1/requirements/:id/decomposition/status', async ({ params }) => {
    await delay(200);

    const requirementId = params.id as string;
    let progress = decompositionProgress.get(requirementId);

    // Create new progress if not exists
    if (!progress) {
      progress = {
        requirementId,
        progress: 0,
        stage: 'queued',
        startedAt: new Date().toISOString(),
      };
      decompositionProgress.set(requirementId, progress);
    }

    // Simulate progress
    simulateProgress(requirementId);
    progress = decompositionProgress.get(requirementId)!;

    const stageDescriptions: Record<string, string> = {
      queued: 'Waiting to start...',
      extracting: 'Extracting text from document...',
      classifying: 'Classifying requirement type...',
      decomposing: 'Breaking down into themes and features...',
      scoring: 'Calculating readiness scores...',
      completed: 'Decomposition complete',
    };

    return HttpResponse.json({
      requirementId: progress.requirementId,
      status: progress.stage,
      progress: progress.progress,
      currentStage: stageDescriptions[progress.stage] || progress.stage,
      estimatedTimeRemaining: Math.max(0, Math.ceil((100 - progress.progress) * 0.6)),
      startedAt: progress.startedAt,
      completedAt: progress.stage === 'completed' ? new Date().toISOString() : undefined,
    });
  }),

  // Get decomposition results
  http.get('/api/v1/requirements/:id/decomposition', async ({ params }) => {
    await delay(300);

    const requirementId = params.id as string;

    return HttpResponse.json({
      ...mockDecompositionResult,
      requirementId,
    });
  }),

  // Submit answer
  http.post('/api/v1/questions/:id/answer', async ({ params, request }) => {
    await delay(500);

    const body = (await request.json()) as { answer: string };
    const questionId = params.id as string;

    // Find and update question in mock data
    const question = mockDecompositionResult.clarificationQuestions.find(
      (q) => q.id === questionId
    );

    if (question) {
      question.answered = true;
      question.answer = body.answer;
      question.answeredAt = new Date().toISOString();

      // Update feature readiness if it was a blocking question
      if (question.impact === 'blocking') {
        const feature = mockDecompositionResult.featureCandidates.find(
          (f) => f.id === question.featureId
        );
        if (feature) {
          feature.readinessScore = Math.min(1, feature.readinessScore + 0.1);
          feature.pendingQuestions = Math.max(0, feature.pendingQuestions - 1);
        }
      }
    }

    return HttpResponse.json({
      questionId,
      answered: true,
      answer: body.answer,
      answeredAt: new Date().toISOString(),
      updatedFeature: question
        ? {
            id: question.featureId,
            readinessScore:
              mockDecompositionResult.featureCandidates.find((f) => f.id === question.featureId)
                ?.readinessScore || 0,
          }
        : undefined,
    });
  }),

  // Retry decomposition
  http.post('/api/v1/requirements/:id/decomposition/retry', async ({ params }) => {
    await delay(300);

    const requirementId = params.id as string;

    // Reset progress
    decompositionProgress.set(requirementId, {
      requirementId,
      progress: 0,
      stage: 'queued',
      startedAt: new Date().toISOString(),
    });

    return HttpResponse.json({ success: true });
  }),
];

// Export for testing
export function resetDecompositionProgress() {
  decompositionProgress.clear();
}
