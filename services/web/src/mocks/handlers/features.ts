import { http, HttpResponse } from 'msw';
import type { FeatureStats } from '@/types';

interface BacklogFeature {
  id: string;
  title: string;
  description?: string;
  status: string;
  priorityScore: number;
  readinessScore: number;
  currentLoop?: 'A' | 'B' | 'C';
  loopProgress?: number;
  pendingQuestions: number;
  blockedBy?: string[];
  themes?: string[];
  acceptanceCriteria?: string[];
  requirementId?: string;
  createdAt: string;
  updatedAt: string;
  projectId: string;
}

const mockFeatures: BacklogFeature[] = [
  // Now Playing (in active loops)
  {
    id: 'feat-307',
    title: 'SSO Authentication',
    description: 'Implement Single Sign-On authentication with OAuth2/OIDC support',
    status: 'in_loop_b',
    priorityScore: 0.92,
    readinessScore: 0.78,
    currentLoop: 'B',
    loopProgress: 80,
    pendingQuestions: 0,
    themes: ['Security', 'Authentication'],
    acceptanceCriteria: [
      'Support Google and Microsoft OAuth providers',
      'JWT tokens issued on successful auth',
      'Session management with refresh tokens',
    ],
    requirementId: 'req-001',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z',
    projectId: 'proj-001',
  },
  {
    id: 'feat-289',
    title: 'User Profile Management',
    description: 'Allow users to view and edit their profile information',
    status: 'in_loop_a',
    priorityScore: 0.88,
    readinessScore: 0.85,
    currentLoop: 'A',
    loopProgress: 45,
    pendingQuestions: 0,
    themes: ['User Management', 'UI'],
    requirementId: 'req-001',
    createdAt: '2024-01-14T09:00:00Z',
    updatedAt: '2024-01-19T11:00:00Z',
    projectId: 'proj-001',
  },
  {
    id: 'feat-315',
    title: 'Email Notifications',
    description: 'Send email notifications for key user events',
    status: 'in_loop_c',
    priorityScore: 0.75,
    readinessScore: 0.90,
    currentLoop: 'C',
    loopProgress: 30,
    pendingQuestions: 0,
    themes: ['Notifications', 'Communication'],
    requirementId: 'req-002',
    createdAt: '2024-01-10T08:00:00Z',
    updatedAt: '2024-01-18T16:00:00Z',
    projectId: 'proj-001',
  },

  // Ready Soon (high readiness, few questions)
  {
    id: 'feat-412',
    title: 'Payment Gateway Integration',
    description: 'Integrate Stripe for payment processing',
    status: 'backlog',
    priorityScore: 0.85,
    readinessScore: 0.82,
    pendingQuestions: 1,
    themes: ['Payments', 'Integration'],
    acceptanceCriteria: [
      'Support credit card payments',
      'Handle subscription billing',
      'PCI compliance requirements met',
    ],
    requirementId: 'req-002',
    createdAt: '2024-01-12T11:00:00Z',
    updatedAt: '2024-01-17T10:00:00Z',
    projectId: 'proj-001',
  },
  {
    id: 'feat-398',
    title: 'Push Notifications',
    description: 'Implement push notifications for web and mobile',
    status: 'backlog',
    priorityScore: 0.78,
    readinessScore: 0.75,
    pendingQuestions: 2,
    themes: ['Notifications', 'Mobile'],
    requirementId: 'req-002',
    createdAt: '2024-01-11T14:00:00Z',
    updatedAt: '2024-01-16T09:00:00Z',
    projectId: 'proj-001',
  },
  {
    id: 'feat-401',
    title: 'API Rate Limiting',
    description: 'Implement rate limiting for API endpoints',
    status: 'backlog',
    priorityScore: 0.72,
    readinessScore: 0.88,
    pendingQuestions: 0,
    themes: ['Security', 'API'],
    requirementId: 'req-003',
    createdAt: '2024-01-13T10:00:00Z',
    updatedAt: '2024-01-18T12:00:00Z',
    projectId: 'proj-001',
  },
  {
    id: 'feat-425',
    title: 'Search Functionality',
    description: 'Full-text search across all content',
    status: 'backlog',
    priorityScore: 0.68,
    readinessScore: 0.72,
    pendingQuestions: 1,
    themes: ['Search', 'UX'],
    requirementId: 'req-003',
    createdAt: '2024-01-14T08:00:00Z',
    updatedAt: '2024-01-19T10:00:00Z',
    projectId: 'proj-001',
  },
  {
    id: 'feat-430',
    title: 'Data Export',
    description: 'Allow users to export their data in multiple formats',
    status: 'backlog',
    priorityScore: 0.65,
    readinessScore: 0.80,
    pendingQuestions: 0,
    themes: ['Data', 'Export'],
    requirementId: 'req-003',
    createdAt: '2024-01-15T09:00:00Z',
    updatedAt: '2024-01-19T14:00:00Z',
    projectId: 'proj-001',
  },

  // Needs Attention (blocked or many questions)
  {
    id: 'feat-215',
    title: 'Report Export Module',
    description: 'Generate and export reports in PDF and Excel formats',
    status: 'blocked',
    priorityScore: 0.72,
    readinessScore: 0.65,
    pendingQuestions: 0,
    blockedBy: ['feat-307'],
    themes: ['Reports', 'Export'],
    requirementId: 'req-001',
    createdAt: '2024-01-08T10:00:00Z',
    updatedAt: '2024-01-15T14:00:00Z',
    projectId: 'proj-001',
  },
  {
    id: 'feat-342',
    title: 'Audit Logging',
    description: 'Comprehensive audit logging for compliance',
    status: 'needs_clarification',
    priorityScore: 0.68,
    readinessScore: 0.55,
    pendingQuestions: 3,
    themes: ['Security', 'Compliance'],
    requirementId: 'req-002',
    createdAt: '2024-01-09T09:00:00Z',
    updatedAt: '2024-01-14T11:00:00Z',
    projectId: 'proj-001',
  },

  // Waiting (low priority or deferred)
  {
    id: 'feat-501',
    title: 'Dark Mode Support',
    description: 'Implement dark mode theme across the application',
    status: 'backlog',
    priorityScore: 0.45,
    readinessScore: 0.70,
    pendingQuestions: 0,
    themes: ['UI', 'Theme'],
    requirementId: 'req-003',
    createdAt: '2024-01-05T08:00:00Z',
    updatedAt: '2024-01-10T10:00:00Z',
    projectId: 'proj-001',
  },
  {
    id: 'feat-445',
    title: 'Mobile App Shell',
    description: 'Create native mobile app shell using React Native',
    status: 'deferred',
    priorityScore: 0.52,
    readinessScore: 0.60,
    pendingQuestions: 0,
    themes: ['Mobile', 'React Native'],
    requirementId: 'req-003',
    createdAt: '2024-01-06T11:00:00Z',
    updatedAt: '2024-01-11T15:00:00Z',
    projectId: 'proj-001',
  },
  {
    id: 'feat-510',
    title: 'Multi-language Support',
    description: 'Internationalization and localization support',
    status: 'backlog',
    priorityScore: 0.38,
    readinessScore: 0.50,
    pendingQuestions: 0,
    themes: ['i18n', 'UX'],
    requirementId: 'req-003',
    createdAt: '2024-01-07T10:00:00Z',
    updatedAt: '2024-01-12T09:00:00Z',
    projectId: 'proj-001',
  },
  {
    id: 'feat-520',
    title: 'Social Media Integration',
    description: 'Share content to social media platforms',
    status: 'deferred',
    priorityScore: 0.35,
    readinessScore: 0.45,
    pendingQuestions: 0,
    themes: ['Social', 'Integration'],
    requirementId: 'req-003',
    createdAt: '2024-01-08T14:00:00Z',
    updatedAt: '2024-01-13T11:00:00Z',
    projectId: 'proj-001',
  },
  {
    id: 'feat-535',
    title: 'Analytics Dashboard',
    description: 'User analytics and usage metrics dashboard',
    status: 'backlog',
    priorityScore: 0.42,
    readinessScore: 0.55,
    pendingQuestions: 0,
    themes: ['Analytics', 'Dashboard'],
    requirementId: 'req-003',
    createdAt: '2024-01-09T08:00:00Z',
    updatedAt: '2024-01-14T10:00:00Z',
    projectId: 'proj-001',
  },
  {
    id: 'feat-550',
    title: 'Bulk Import Tool',
    description: 'Import data in bulk from CSV and Excel files',
    status: 'backlog',
    priorityScore: 0.48,
    readinessScore: 0.62,
    pendingQuestions: 0,
    themes: ['Data', 'Import'],
    requirementId: 'req-003',
    createdAt: '2024-01-10T11:00:00Z',
    updatedAt: '2024-01-15T13:00:00Z',
    projectId: 'proj-001',
  },
  {
    id: 'feat-565',
    title: 'Webhooks System',
    description: 'Allow third-party integrations via webhooks',
    status: 'backlog',
    priorityScore: 0.40,
    readinessScore: 0.58,
    pendingQuestions: 0,
    themes: ['Integration', 'API'],
    requirementId: 'req-003',
    createdAt: '2024-01-11T09:00:00Z',
    updatedAt: '2024-01-16T08:00:00Z',
    projectId: 'proj-001',
  },
];

// Helper functions to categorize features
function getNowPlaying(): BacklogFeature[] {
  return mockFeatures
    .filter((f) => ['in_loop_a', 'in_loop_b', 'in_loop_c'].includes(f.status))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

function getReadySoon(): BacklogFeature[] {
  return mockFeatures
    .filter(
      (f) =>
        f.status === 'backlog' &&
        f.readinessScore >= 0.7 &&
        f.pendingQuestions <= 2 &&
        !f.blockedBy?.length
    )
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

function getNeedsAttention(): BacklogFeature[] {
  return mockFeatures
    .filter(
      (f) =>
        f.status === 'blocked' ||
        f.status === 'needs_clarification' ||
        (f.blockedBy && f.blockedBy.length > 0) ||
        f.pendingQuestions >= 3
    )
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

function getWaiting(): BacklogFeature[] {
  const nowPlaying = getNowPlaying();
  const readySoon = getReadySoon();
  const needsAttention = getNeedsAttention();
  const usedIds = new Set([
    ...nowPlaying.map((f) => f.id),
    ...readySoon.map((f) => f.id),
    ...needsAttention.map((f) => f.id),
  ]);

  return mockFeatures
    .filter((f) => !usedIds.has(f.id))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

export const featureHandlers = [
  // Get backlog summary (all views)
  http.get('/api/v1/backlog/summary', ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase();
    const minReadiness = parseFloat(url.searchParams.get('minReadiness') || '0');

    let features = [...mockFeatures];

    // Apply filters
    if (search) {
      features = features.filter(
        (f) =>
          f.title.toLowerCase().includes(search) ||
          f.id.toLowerCase().includes(search) ||
          f.description?.toLowerCase().includes(search)
      );
    }

    if (minReadiness > 0) {
      features = features.filter((f) => f.readinessScore >= minReadiness);
    }

    // Categorize filtered features
    const nowPlaying = features
      .filter((f) => ['in_loop_a', 'in_loop_b', 'in_loop_c'].includes(f.status))
      .sort((a, b) => b.priorityScore - a.priorityScore);

    const readySoon = features
      .filter(
        (f) =>
          f.status === 'backlog' &&
          f.readinessScore >= 0.7 &&
          f.pendingQuestions <= 2 &&
          !f.blockedBy?.length
      )
      .sort((a, b) => b.priorityScore - a.priorityScore);

    const needsAttention = features
      .filter(
        (f) =>
          f.status === 'blocked' ||
          f.status === 'needs_clarification' ||
          (f.blockedBy && f.blockedBy.length > 0) ||
          f.pendingQuestions >= 3
      )
      .sort((a, b) => b.priorityScore - a.priorityScore);

    const usedIds = new Set([
      ...nowPlaying.map((f) => f.id),
      ...readySoon.map((f) => f.id),
      ...needsAttention.map((f) => f.id),
    ]);

    const waiting = features
      .filter((f) => !usedIds.has(f.id))
      .sort((a, b) => b.priorityScore - a.priorityScore);

    return HttpResponse.json({
      nowPlaying: {
        name: 'Now Playing',
        count: nowPlaying.length,
        items: nowPlaying,
      },
      readySoon: {
        name: 'Ready Soon',
        count: readySoon.length,
        items: readySoon,
      },
      needsAttention: {
        name: 'Needs Attention',
        count: needsAttention.length,
        items: needsAttention,
      },
      waiting: { name: 'Waiting', count: waiting.length, items: waiting },
      totalFeatures: features.length,
    });
  }),

  // Get all features
  http.get('/api/v1/features', ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase();
    const status = url.searchParams.get('status');
    const minReadiness = parseFloat(url.searchParams.get('minReadiness') || '0');

    let filtered = [...mockFeatures];

    if (search) {
      filtered = filtered.filter(
        (f) =>
          f.title.toLowerCase().includes(search) ||
          f.id.toLowerCase().includes(search)
      );
    }

    if (status) {
      filtered = filtered.filter((f) => f.status === status);
    }

    if (minReadiness > 0) {
      filtered = filtered.filter((f) => f.readinessScore >= minReadiness);
    }

    return HttpResponse.json({
      data: filtered,
      total: filtered.length,
      page: 1,
      limit: 50,
      hasMore: false,
    });
  }),

  // Get feature stats
  http.get('/api/v1/features/stats', () => {
    const stats: FeatureStats = {
      total: mockFeatures.length,
      ready: getNowPlaying().length + getReadySoon().length,
      inProgress: getNowPlaying().length,
      needsAttention: getNeedsAttention().length,
      pending: getWaiting().length,
    };
    return HttpResponse.json(stats);
  }),

  // Get recent features
  http.get('/api/v1/features/recent', () => {
    const recent = [...mockFeatures]
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      .slice(0, 5);
    return HttpResponse.json({ features: recent });
  }),

  // Get single feature
  http.get('/api/v1/features/:id', ({ params }) => {
    const feature = mockFeatures.find((f) => f.id === params.id);
    if (feature) {
      return HttpResponse.json(feature);
    }
    return HttpResponse.json({ error: 'Feature not found' }, { status: 404 });
  }),

  // Update feature
  http.patch('/api/v1/features/:id', async ({ params, request }) => {
    const body = (await request.json()) as Partial<BacklogFeature>;
    const feature = mockFeatures.find((f) => f.id === params.id);
    if (feature) {
      Object.assign(feature, body);
      feature.updatedAt = new Date().toISOString();
      return HttpResponse.json(feature);
    }
    return HttpResponse.json({ error: 'Feature not found' }, { status: 404 });
  }),

  // Update feature status
  http.patch('/api/v1/features/:id/status', async ({ params, request }) => {
    const body = (await request.json()) as { status: string };
    const feature = mockFeatures.find((f) => f.id === params.id);
    if (feature) {
      feature.status = body.status;
      feature.updatedAt = new Date().toISOString();
      return HttpResponse.json(feature);
    }
    return HttpResponse.json({ error: 'Feature not found' }, { status: 404 });
  }),
];
