import { http, HttpResponse, delay } from 'msw';

// Mock feature detail data
const mockFeatureDetails: Record<string, {
  id: string;
  title: string;
  description: string;
  status: string;
  readinessScore: number;
  readinessBreakdown: {
    businessClarity: number;
    technicalClarity: number;
    testability: number;
    completeness: number;
  };
  priorityScore: number;
  priorityFactors: {
    businessValue: number;
    urgency: number;
    complexity: number;
    readiness: number;
    dependencies: number;
  };
  estimatedComplexity: string;
  tags: string[];
  themeIds: string[];
  dependencies: Array<{
    featureId: string;
    featureTitle: string;
    dependencyType: string;
    status: string;
  }>;
  blockedBy: string[];
  blocks: string[];
  requirementCount: number;
  questionCount: number;
  blockingQuestionCount: number;
  currentLoop?: 'A' | 'B' | 'C';
  loopProgress?: number;
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
  projectId: string;
}> = {
  'f-001': {
    id: 'f-001',
    title: 'User Registration',
    description: 'Allow users to create accounts with email and password. Includes email verification and password strength requirements.',
    status: 'backlog',
    readinessScore: 0.85,
    readinessBreakdown: {
      businessClarity: 0.88,
      technicalClarity: 0.82,
      testability: 0.90,
      completeness: 0.80,
    },
    priorityScore: 0.82,
    priorityFactors: {
      businessValue: 0.85,
      urgency: 0.75,
      complexity: -0.15,
      readiness: 0.85,
      dependencies: 0,
    },
    estimatedComplexity: 'medium',
    tags: ['auth', 'mvp', 'security'],
    themeIds: ['th-001'],
    dependencies: [],
    blockedBy: [],
    blocks: ['f-002'],
    requirementCount: 3,
    questionCount: 0,
    blockingQuestionCount: 0,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T14:32:00Z',
    projectId: 'proj-001',
  },
  'f-002': {
    id: 'f-002',
    title: 'User Login',
    description: 'Secure authentication with email/password and OAuth providers (Google, GitHub).',
    status: 'backlog',
    readinessScore: 0.90,
    readinessBreakdown: {
      businessClarity: 0.92,
      technicalClarity: 0.88,
      testability: 0.92,
      completeness: 0.88,
    },
    priorityScore: 0.88,
    priorityFactors: {
      businessValue: 0.90,
      urgency: 0.85,
      complexity: -0.10,
      readiness: 0.90,
      dependencies: -0.05,
    },
    estimatedComplexity: 'medium',
    tags: ['auth', 'mvp', 'security'],
    themeIds: ['th-001'],
    dependencies: [
      { featureId: 'f-001', featureTitle: 'User Registration', dependencyType: 'blocks', status: 'backlog' },
    ],
    blockedBy: ['f-001'],
    blocks: [],
    requirementCount: 2,
    questionCount: 0,
    blockingQuestionCount: 0,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T14:32:00Z',
    projectId: 'proj-001',
  },
  'f-005': {
    id: 'f-005',
    title: 'Shopping Cart',
    description: 'Add/remove items from cart, adjust quantities, apply coupon codes, and view cart summary before checkout.',
    status: 'backlog',
    readinessScore: 0.78,
    readinessBreakdown: {
      businessClarity: 0.80,
      technicalClarity: 0.72,
      testability: 0.82,
      completeness: 0.78,
    },
    priorityScore: 0.75,
    priorityFactors: {
      businessValue: 0.85,
      urgency: 0.70,
      complexity: -0.15,
      readiness: 0.78,
      dependencies: -0.10,
    },
    estimatedComplexity: 'medium',
    tags: ['cart', 'mvp', 'commerce'],
    themeIds: ['th-003'],
    dependencies: [
      { featureId: 'f-002', featureTitle: 'User Login', dependencyType: 'blocks', status: 'backlog' },
    ],
    blockedBy: ['f-002'],
    blocks: ['f-006'],
    requirementCount: 5,
    questionCount: 2,
    blockingQuestionCount: 1,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T14:32:00Z',
    projectId: 'proj-001',
  },
  'f-006': {
    id: 'f-006',
    title: 'Payment Processing',
    description: 'Process payments via multiple providers (Stripe, PayPal). Handle refunds and subscription billing.',
    status: 'backlog',
    readinessScore: 0.55,
    readinessBreakdown: {
      businessClarity: 0.60,
      technicalClarity: 0.50,
      testability: 0.55,
      completeness: 0.52,
    },
    priorityScore: 0.65,
    priorityFactors: {
      businessValue: 0.90,
      urgency: 0.60,
      complexity: -0.25,
      readiness: 0.55,
      dependencies: -0.15,
    },
    estimatedComplexity: 'very_high',
    tags: ['payments', 'integration'],
    themeIds: ['th-004'],
    dependencies: [
      { featureId: 'f-005', featureTitle: 'Shopping Cart', dependencyType: 'blocks', status: 'backlog' },
    ],
    blockedBy: ['f-005'],
    blocks: [],
    requirementCount: 2,
    questionCount: 2,
    blockingQuestionCount: 2,
    createdAt: '2024-01-12T11:00:00Z',
    updatedAt: '2024-01-17T10:00:00Z',
    projectId: 'proj-001',
  },
};

// Mock requirements by feature
const mockRequirements: Record<string, Array<{
  id: string;
  text: string;
  clarity: number;
  testable: boolean;
  themeId: string;
  themeName: string;
  acceptanceCriteria?: string[];
}>> = {
  'f-001': [
    { id: 'ar-001', text: 'Users can register with email and password', clarity: 0.90, testable: true, themeId: 'th-001', themeName: 'Authentication', acceptanceCriteria: ['Registration form displays', 'Email validation works', 'Password confirmation matches'] },
    { id: 'ar-002', text: 'Email verification required before account activation', clarity: 0.85, testable: true, themeId: 'th-001', themeName: 'Authentication' },
    { id: 'ar-003', text: 'Password must meet security requirements (8+ chars, mixed case, number)', clarity: 0.92, testable: true, themeId: 'th-001', themeName: 'Authentication', acceptanceCriteria: ['Minimum 8 characters', 'At least one uppercase', 'At least one number'] },
  ],
  'f-005': [
    { id: 'ar-011', text: 'Users can add products to cart from product detail page', clarity: 0.90, testable: true, themeId: 'th-003', themeName: 'Shopping Cart', acceptanceCriteria: ['Add button visible', 'Quantity selector available', 'Success toast shown'] },
    { id: 'ar-012', text: 'Users can remove items from cart', clarity: 0.88, testable: true, themeId: 'th-003', themeName: 'Shopping Cart' },
    { id: 'ar-013', text: 'Users can adjust item quantities in cart', clarity: 0.85, testable: true, themeId: 'th-003', themeName: 'Shopping Cart' },
    { id: 'ar-014', text: 'Cart persists across browser sessions for logged-in users', clarity: 0.72, testable: true, themeId: 'th-003', themeName: 'Shopping Cart' },
    { id: 'ar-015', text: 'Users can apply coupon codes to cart', clarity: 0.65, testable: true, themeId: 'th-003', themeName: 'Shopping Cart', acceptanceCriteria: ['Input field for code', 'Apply button', 'Discount shown', 'Invalid code error'] },
  ],
};

// Mock questions by feature
const mockQuestions: Record<string, Array<{
  id: string;
  featureId: string;
  question: string;
  questionType: string;
  options?: string[];
  impact: string;
  category: string;
  answered: boolean;
  answer?: string;
  answeredAt?: string;
}>> = {
  'f-005': [
    { id: 'q-005', featureId: 'f-005', question: 'Should cart persist for guest users (using localStorage)?', questionType: 'yes_no', impact: 'blocking', category: 'technical', answered: false },
    { id: 'q-006', featureId: 'f-005', question: 'What is the maximum number of items allowed in cart?', questionType: 'text', impact: 'clarifying', category: 'business', answered: true, answer: '50 items', answeredAt: '2024-01-19T11:30:00Z' },
  ],
  'f-006': [
    { id: 'q-001', featureId: 'f-006', question: 'Which payment providers should be supported?', questionType: 'multiple_choice', options: ['Stripe only', 'Stripe + PayPal', 'Stripe + PayPal + Apple Pay', 'Custom selection'], impact: 'blocking', category: 'business', answered: false },
    { id: 'q-002', featureId: 'f-006', question: 'Should we support recurring payments/subscriptions?', questionType: 'yes_no', impact: 'blocking', category: 'scope', answered: false },
  ],
};

// Mock history by feature
const mockHistory: Record<string, Array<{
  id: string;
  featureId: string;
  action: string;
  timestamp: string;
  actor: { id: string; name: string; type: string };
  details: Record<string, unknown>;
  previousValue?: unknown;
  newValue?: unknown;
}>> = {
  'f-005': [
    { id: 'audit-001', featureId: 'f-005', action: 'question_answered', timestamp: '2024-01-20T14:32:00Z', actor: { id: 'user-001', name: 'Sarah Chen', type: 'user' }, details: { questionId: 'q-006', question: 'What is the maximum number of items allowed in cart?', answer: '50 items' } },
    { id: 'audit-002', featureId: 'f-005', action: 'readiness_updated', timestamp: '2024-01-20T10:15:00Z', actor: { id: 'system', name: 'System', type: 'system' }, details: { reason: 'Auto-recalculation after question answered' }, previousValue: 0.65, newValue: 0.78 },
    { id: 'audit-003', featureId: 'f-005', action: 'priority_override', timestamp: '2024-01-19T16:45:00Z', actor: { id: 'user-002', name: 'John Smith', type: 'user' }, details: { reason: 'Client requested higher priority' }, previousValue: 0.70, newValue: 0.75 },
    { id: 'audit-004', featureId: 'f-005', action: 'created', timestamp: '2024-01-15T09:30:00Z', actor: { id: 'system', name: 'System', type: 'system' }, details: { source: 'Decomposition of e-commerce-rfp.pdf', version: 1 } },
  ],
};

export const featureDetailHandlers = [
  // Get feature detail (extended version with all fields)
  http.get('/api/v1/features/:id', async ({ params }) => {
    await delay(300);

    const featureId = params.id as string;
    const feature = mockFeatureDetails[featureId];

    if (feature) {
      return HttpResponse.json(feature);
    }

    // Return a default feature if not found in detailed mocks
    return HttpResponse.json({
      id: featureId,
      title: `Feature ${featureId}`,
      description: 'A feature extracted from requirements.',
      status: 'backlog',
      readinessScore: 0.75,
      readinessBreakdown: {
        businessClarity: 0.78,
        technicalClarity: 0.72,
        testability: 0.80,
        completeness: 0.70,
      },
      priorityScore: 0.70,
      priorityFactors: {
        businessValue: 0.75,
        urgency: 0.65,
        complexity: -0.15,
        readiness: 0.75,
        dependencies: 0,
      },
      estimatedComplexity: 'medium',
      tags: ['feature'],
      themeIds: [],
      dependencies: [],
      blockedBy: [],
      blocks: [],
      requirementCount: 3,
      questionCount: 1,
      blockingQuestionCount: 0,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      projectId: 'proj-001',
    });
  }),

  // Get feature requirements
  http.get('/api/v1/features/:id/requirements', async ({ params }) => {
    await delay(200);

    const featureId = params.id as string;
    const requirements = mockRequirements[featureId] || [
      { id: 'ar-default-1', text: 'Default requirement 1', clarity: 0.75, testable: true, themeId: 'th-001', themeName: 'General' },
      { id: 'ar-default-2', text: 'Default requirement 2', clarity: 0.80, testable: true, themeId: 'th-001', themeName: 'General' },
    ];

    return HttpResponse.json(requirements);
  }),

  // Get feature questions
  http.get('/api/v1/features/:id/questions', async ({ params }) => {
    await delay(200);

    const featureId = params.id as string;
    const questions = mockQuestions[featureId] || [];

    return HttpResponse.json(questions);
  }),

  // Get feature history
  http.get('/api/v1/features/:id/history', async ({ params }) => {
    await delay(200);

    const featureId = params.id as string;
    const history = mockHistory[featureId] || [
      { id: 'audit-default', featureId, action: 'created', timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), actor: { id: 'system', name: 'System', type: 'system' }, details: { source: 'Decomposition' } },
    ];

    return HttpResponse.json(history);
  }),

  // Approve feature
  http.post('/api/v1/features/:id/approve', async ({ params }) => {
    await delay(500);

    const featureId = params.id as string;
    const feature = mockFeatureDetails[featureId];

    if (feature) {
      feature.status = 'approved';
      feature.approvedAt = new Date().toISOString();
      feature.approvedBy = 'user-001';
    }

    return HttpResponse.json({
      featureId,
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: 'user-001',
    });
  }),

  // Start loop
  http.post('/api/v1/features/:id/start-loop', async ({ params, request }) => {
    await delay(500);

    const body = (await request.json()) as { loop: 'A' | 'B' | 'C' };
    const featureId = params.id as string;
    const feature = mockFeatureDetails[featureId];

    if (feature) {
      feature.status = `in_loop_${body.loop.toLowerCase()}`;
      feature.currentLoop = body.loop;
      feature.loopProgress = 0;
    }

    return HttpResponse.json({
      featureId,
      status: `in_loop_${body.loop.toLowerCase()}`,
      loopStartedAt: new Date().toISOString(),
    });
  }),

  // Update feature (including priority)
  http.patch('/api/v1/features/:id', async ({ params, request }) => {
    await delay(300);

    const body = (await request.json()) as { priorityScore?: number };
    const featureId = params.id as string;
    const feature = mockFeatureDetails[featureId];

    if (feature && body.priorityScore !== undefined) {
      feature.priorityScore = body.priorityScore;
      feature.updatedAt = new Date().toISOString();
    }

    return HttpResponse.json({
      featureId,
      priorityScore: body.priorityScore,
      updatedAt: new Date().toISOString(),
    });
  }),
];
