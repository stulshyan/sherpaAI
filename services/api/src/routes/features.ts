// Features routes

import type { Feature, FeatureStatus } from '@entropy/shared';
import { Router, type IRouter } from 'express';

export const featuresRouter: IRouter = Router();

// Extended feature interface for demo purposes
// In production, clarifications would come from a separate table
interface Clarification {
  id: string;
  question: string;
  status: 'pending' | 'answered';
  answer?: string;
  createdAt: Date;
  answeredAt?: Date;
}

interface DemoFeature extends Feature {
  clarifications?: Clarification[];
  themes?: string[];
  acceptanceCriteria?: string[];
}

// Mock data for demo purposes
// TODO: Replace with database queries
const mockFeatures: DemoFeature[] = [
  {
    id: 'f-001',
    requirementId: 'req-001',
    projectId: 'proj-001',
    title: 'User Authentication Flow',
    description: 'Implement secure user authentication with OAuth 2.0',
    status: 'ready',
    readinessScore: 0.92,
    priorityScore: 0.85,
    clarifications: [],
    themes: ['authentication', 'security'],
    acceptanceCriteria: [
      'Users can sign in with email/password',
      'Users can sign in with Google OAuth',
      'Session management with JWT tokens',
    ],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
  },
  {
    id: 'f-002',
    requirementId: 'req-001',
    projectId: 'proj-001',
    title: 'Password Reset Flow',
    description: 'Allow users to reset their password via email',
    status: 'ready',
    readinessScore: 0.88,
    priorityScore: 0.72,
    clarifications: [],
    themes: ['authentication'],
    acceptanceCriteria: [
      'User can request password reset',
      'Reset link expires after 24 hours',
      'Email notification on password change',
    ],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-18'),
  },
  {
    id: 'f-003',
    requirementId: 'req-002',
    projectId: 'proj-001',
    title: 'Dashboard Overview',
    description: 'Main dashboard showing key metrics and recent activity',
    status: 'in_progress',
    readinessScore: 0.65,
    priorityScore: 0.9,
    clarifications: [
      {
        id: 'cl-001',
        question: 'What metrics should be displayed on the dashboard?',
        status: 'pending',
        createdAt: new Date('2024-01-16'),
      },
    ],
    themes: ['dashboard', 'analytics'],
    acceptanceCriteria: [
      'Show total user count',
      'Display recent activity feed',
      'Show system health indicators',
    ],
    createdAt: new Date('2024-01-16'),
    updatedAt: new Date('2024-01-21'),
  },
  {
    id: 'f-004',
    requirementId: 'req-002',
    projectId: 'proj-001',
    title: 'Real-time Notifications',
    description: 'Push notifications for important events',
    status: 'draft',
    readinessScore: 0.45,
    priorityScore: 0.6,
    clarifications: [
      {
        id: 'cl-002',
        question: 'Should notifications support email delivery?',
        status: 'pending',
        createdAt: new Date('2024-01-17'),
      },
      {
        id: 'cl-003',
        question: 'What events trigger notifications?',
        status: 'pending',
        createdAt: new Date('2024-01-17'),
      },
    ],
    themes: ['notifications', 'real-time'],
    acceptanceCriteria: [
      'In-app notification center',
      'Browser push notifications',
      'Configurable notification preferences',
    ],
    createdAt: new Date('2024-01-17'),
    updatedAt: new Date('2024-01-17'),
  },
  {
    id: 'f-005',
    requirementId: 'req-003',
    projectId: 'proj-001',
    title: 'File Upload System',
    description: 'Support uploading and managing document files',
    status: 'draft',
    readinessScore: 0.35,
    priorityScore: 0.55,
    clarifications: [],
    themes: ['files', 'storage'],
    acceptanceCriteria: [
      'Support PDF, DOCX, TXT, MD file types',
      'Max file size 10MB',
      'Progress indicator during upload',
    ],
    createdAt: new Date('2024-01-18'),
    updatedAt: new Date('2024-01-18'),
  },
];

// Map frontend status names to FeatureStatus
function mapStatusToFeatureStatus(status: string): FeatureStatus {
  const mapping: Record<string, FeatureStatus> = {
    pending: 'draft',
    ready: 'ready',
    in_progress: 'in_progress',
    done: 'completed',
  };
  return mapping[status] || 'draft';
}

// Map FeatureStatus to frontend status names for API response
function mapFeatureStatusToFrontend(status: FeatureStatus): string {
  const mapping: Record<FeatureStatus, string> = {
    draft: 'pending',
    needs_clarification: 'pending',
    ready: 'ready',
    in_progress: 'in_progress',
    completed: 'done',
    blocked: 'pending',
    cancelled: 'pending',
  };
  return mapping[status] || 'pending';
}

/**
 * GET /api/v1/features/stats
 * Get feature statistics for dashboard
 */
featuresRouter.get('/stats', async (_req, res, next) => {
  try {
    // Calculate stats from mock data
    // TODO: Replace with database aggregation
    const total = mockFeatures.length;
    const ready = mockFeatures.filter((f) => f.status === 'ready').length;
    const inProgress = mockFeatures.filter((f) => f.status === 'in_progress').length;
    const needsAttention = mockFeatures.filter(
      (f) => f.clarifications && f.clarifications.some((c) => c.status === 'pending')
    ).length;
    const pending = mockFeatures.filter(
      (f) => f.status === 'draft' || f.status === 'needs_clarification'
    ).length;

    res.json({
      total,
      ready,
      inProgress,
      needsAttention,
      pending,
      byStatus: {
        ready,
        in_progress: inProgress,
        pending,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/features/recent
 * Get recent feature activity
 */
featuresRouter.get('/recent', async (_req, res, next) => {
  try {
    const limit = 10;

    // Sort by updatedAt descending and take top N
    const recentFeatures = [...mockFeatures]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit)
      .map((f) => ({
        id: f.id,
        title: f.title,
        status: mapFeatureStatusToFrontend(f.status),
        readinessScore: f.readinessScore,
        updatedAt: f.updatedAt,
      }));

    res.json({
      features: recentFeatures,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/features
 * List features with filtering
 */
featuresRouter.get('/', async (req, res, next) => {
  try {
    const { page = '1', limit = '20', status, minReadiness, search } = req.query;

    let filtered = [...mockFeatures];

    // Filter by status
    if (status && typeof status === 'string') {
      const featureStatus = mapStatusToFeatureStatus(status);
      filtered = filtered.filter((f) => f.status === featureStatus);
    }

    // Filter by minimum readiness score
    if (minReadiness && typeof minReadiness === 'string') {
      const minScore = parseFloat(minReadiness);
      filtered = filtered.filter((f) => f.readinessScore >= minScore);
    }

    // Search in title and description
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (f) =>
          f.title.toLowerCase().includes(searchLower) ||
          f.description.toLowerCase().includes(searchLower)
      );
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;

    const paginatedFeatures = filtered.slice(startIndex, endIndex).map((f) => ({
      ...f,
      status: mapFeatureStatusToFrontend(f.status as FeatureStatus),
    }));

    res.json({
      data: paginatedFeatures,
      total: filtered.length,
      page: pageNum,
      limit: limitNum,
      hasMore: endIndex < filtered.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/features/:id
 * Get feature by ID
 */
featuresRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const feature = mockFeatures.find((f) => f.id === id);

    if (!feature) {
      res.status(404).json({ error: 'Feature not found' });
      return;
    }

    res.json({
      ...feature,
      status: mapFeatureStatusToFrontend(feature.status),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/features/:id
 * Update feature
 */
featuresRouter.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const featureIndex = mockFeatures.findIndex((f) => f.id === id);

    if (featureIndex === -1) {
      res.status(404).json({ error: 'Feature not found' });
      return;
    }

    // Update in mock data
    const existingFeature = mockFeatures[featureIndex]!;
    mockFeatures[featureIndex] = {
      ...existingFeature,
      ...updates,
      updatedAt: new Date(),
    };

    const updatedFeature = mockFeatures[featureIndex]!;
    res.json({
      ...updatedFeature,
      status: mapFeatureStatusToFrontend(updatedFeature.status),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/features/:id/status
 * Update feature status (for kanban drag-drop)
 */
featuresRouter.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const featureIndex = mockFeatures.findIndex((f) => f.id === id);

    if (featureIndex === -1) {
      res.status(404).json({ error: 'Feature not found' });
      return;
    }

    if (!['pending', 'ready', 'in_progress', 'done'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    const feature = mockFeatures[featureIndex]!;
    feature.status = mapStatusToFeatureStatus(status);
    feature.updatedAt = new Date();

    res.json({
      ...feature,
      status: mapFeatureStatusToFrontend(feature.status),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/features/:id/approve
 * Approve feature for next loop
 */
featuresRouter.post('/:id/approve', async (req, res, next) => {
  try {
    const { id } = req.params;

    const feature = mockFeatures.find((f) => f.id === id);

    if (!feature) {
      res.status(404).json({ error: 'Feature not found' });
      return;
    }

    feature.status = 'in_progress';
    feature.updatedAt = new Date();

    res.json({
      id,
      status: 'approved',
      message: 'Feature approved for next loop',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/features/:id/answer
 * Answer clarification question
 */
featuresRouter.post('/:id/answer', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { questionId, answer } = req.body;

    const feature = mockFeatures.find((f) => f.id === id);

    if (!feature) {
      res.status(404).json({ error: 'Feature not found' });
      return;
    }

    const clarification = feature.clarifications?.find((c) => c.id === questionId);

    if (!clarification) {
      res.status(404).json({ error: 'Clarification question not found' });
      return;
    }

    clarification.answer = answer;
    clarification.status = 'answered';
    clarification.answeredAt = new Date();

    // Recalculate readiness score
    const totalClarifications = feature.clarifications?.length || 0;
    const answeredClarifications =
      feature.clarifications?.filter((c) => c.status === 'answered').length || 0;

    if (totalClarifications > 0) {
      // Boost readiness based on answered clarifications
      const clarificationBoost = (answeredClarifications / totalClarifications) * 0.2;
      feature.readinessScore = Math.min(1, feature.readinessScore + clarificationBoost);
    }

    feature.updatedAt = new Date();

    res.json({
      featureId: id,
      questionId,
      answered: true,
      newReadinessScore: feature.readinessScore,
      message: 'Question answered',
    });
  } catch (error) {
    next(error);
  }
});
