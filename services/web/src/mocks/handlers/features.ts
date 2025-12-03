import { http, HttpResponse } from 'msw';
import type { Feature, FeatureStats } from '@/types';

const mockFeatures: Feature[] = [
  {
    id: 'feat-001',
    requirementId: 'req-001',
    title: 'User Authentication System',
    description: 'Implement secure user authentication with JWT tokens',
    status: 'ready',
    readinessScore: 0.85,
    priorityScore: 0.9,
    themes: ['Security', 'Authentication'],
    acceptanceCriteria: [
      'Users can register with email and password',
      'Users can login with valid credentials',
      'JWT tokens are issued on successful login',
      'Password reset functionality works',
    ],
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'feat-002',
    requirementId: 'req-001',
    title: 'Role-Based Access Control',
    description: 'Implement RBAC for managing user permissions',
    status: 'in_progress',
    readinessScore: 0.6,
    priorityScore: 0.75,
    themes: ['Security', 'Authorization'],
    acceptanceCriteria: [
      'Admin role has full access',
      'User role has limited access',
      'Permissions are enforced on API endpoints',
    ],
    clarifications: [
      {
        id: 'clar-001',
        question: 'Should we support custom role creation?',
        status: 'pending',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'feat-003',
    requirementId: 'req-002',
    title: 'File Upload Service',
    description: 'Enable users to upload documents for processing',
    status: 'pending',
    readinessScore: 0.45,
    priorityScore: 0.5,
    themes: ['Storage', 'Processing'],
    acceptanceCriteria: [
      'Support PDF, DOCX, TXT, MD files',
      'Maximum file size of 10MB',
      'Progress indicator during upload',
    ],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'feat-004',
    requirementId: 'req-002',
    title: 'AI Decomposition Engine',
    description: 'Break down requirements into actionable features using AI',
    status: 'ready',
    readinessScore: 0.92,
    priorityScore: 0.95,
    themes: ['AI', 'Core Feature'],
    acceptanceCriteria: [
      'Process documents using Claude API',
      'Generate structured feature output',
      'Include quality scores for each feature',
    ],
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'feat-005',
    requirementId: 'req-003',
    title: 'Dashboard Analytics',
    description: 'Display key metrics and statistics on the dashboard',
    status: 'pending',
    readinessScore: 0.3,
    priorityScore: 0.4,
    themes: ['Analytics', 'UI'],
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const featureHandlers = [
  // Get all features
  http.get('/api/v1/features', () => {
    return HttpResponse.json({
      data: mockFeatures,
      total: mockFeatures.length,
      page: 1,
      limit: 50,
      hasMore: false,
    });
  }),

  // Get feature stats
  http.get('/api/v1/features/stats', () => {
    const stats: FeatureStats = {
      total: mockFeatures.length,
      ready: mockFeatures.filter((f) => f.status === 'ready').length,
      inProgress: mockFeatures.filter((f) => f.status === 'in_progress').length,
      needsAttention: mockFeatures.filter((f) =>
        f.clarifications?.some((c) => c.status === 'pending')
      ).length,
      pending: mockFeatures.filter((f) => f.status === 'pending').length,
    };
    return HttpResponse.json(stats);
  }),

  // Get recent features
  http.get('/api/v1/features/recent', () => {
    const recent = [...mockFeatures]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
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

  // Update feature status
  http.patch('/api/v1/features/:id/status', async ({ params, request }) => {
    const body = (await request.json()) as { status: string };
    const feature = mockFeatures.find((f) => f.id === params.id);
    if (feature) {
      feature.status = body.status as Feature['status'];
      feature.updatedAt = new Date().toISOString();
      return HttpResponse.json(feature);
    }
    return HttpResponse.json({ error: 'Feature not found' }, { status: 404 });
  }),
];
