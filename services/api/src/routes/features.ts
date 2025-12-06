// Features routes - Database-backed implementation

import {
  createLogger,
  getDatabase,
  FeatureRepository,
} from '@entropy/shared';
import type { FeatureStatus } from '@entropy/shared';
import { Router, type IRouter } from 'express';

const logger = createLogger('features-routes');

export const featuresRouter: IRouter = Router();

// Initialize repository lazily
let featureRepo: FeatureRepository | null = null;

async function getFeatureRepository(): Promise<FeatureRepository> {
  if (!featureRepo) {
    const db = getDatabase();
    await db.connect();
    featureRepo = new FeatureRepository(db);
  }
  return featureRepo;
}

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
featuresRouter.get('/stats', async (req, res, next) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'projectId query parameter is required',
        },
      });
      return;
    }

    const repo = await getFeatureRepository();
    const statusCounts = await repo.countByStatusForProject(projectId as string);

    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    const ready = statusCounts.ready || 0;
    const inProgress = statusCounts.in_progress || 0;
    const needsAttention = statusCounts.needs_clarification || 0;
    const pending = (statusCounts.draft || 0) + (statusCounts.needs_clarification || 0);

    res.json({
      total,
      ready,
      inProgress,
      needsAttention,
      pending,
      byStatus: statusCounts,
    });
  } catch (error) {
    logger.error('Failed to get feature stats', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * GET /api/v1/features/recent
 * Get recent feature activity
 */
featuresRouter.get('/recent', async (req, res, next) => {
  try {
    const { projectId, limit = '10' } = req.query;

    if (!projectId) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'projectId query parameter is required',
        },
      });
      return;
    }

    const db = getDatabase();
    await db.connect();

    const limitNum = Math.min(parseInt(limit as string, 10), 50);

    const rows = await db.queryAll(
      `SELECT id, title, status, readiness_score, updated_at
       FROM features
       WHERE project_id = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      [projectId, limitNum]
    );

    const recentFeatures = rows.map((f) => ({
      id: f.id,
      title: f.title,
      status: mapFeatureStatusToFrontend(f.status as FeatureStatus),
      readinessScore: parseFloat(f.readiness_score as string) || 0,
      updatedAt: f.updated_at,
    }));

    res.json({
      features: recentFeatures,
    });
  } catch (error) {
    logger.error('Failed to get recent features', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * GET /api/v1/features
 * List features with filtering
 */
featuresRouter.get('/', async (req, res, next) => {
  try {
    const { projectId, page = '1', limit = '20', status, minReadiness, search } = req.query;

    if (!projectId) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'projectId query parameter is required',
        },
      });
      return;
    }

    const db = getDatabase();
    await db.connect();

    let query = `SELECT * FROM features WHERE project_id = $1`;
    const params: unknown[] = [projectId];
    let paramIndex = 2;

    // Filter by status
    if (status && typeof status === 'string') {
      const featureStatus = mapStatusToFeatureStatus(status);
      query += ` AND status = $${paramIndex++}`;
      params.push(featureStatus);
    }

    // Filter by minimum readiness score
    if (minReadiness && typeof minReadiness === 'string') {
      const minScore = parseFloat(minReadiness);
      query += ` AND readiness_score >= $${paramIndex++}`;
      params.push(minScore);
    }

    // Search in title and description
    if (search && typeof search === 'string') {
      query += ` AND (LOWER(title) LIKE $${paramIndex} OR LOWER(description) LIKE $${paramIndex})`;
      params.push(`%${search.toLowerCase()}%`);
      paramIndex++;
    }

    // Count total
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await db.queryOne<{ count: string }>(countQuery, params);
    const total = parseInt(countResult?.count || '0', 10);

    // Add ordering and pagination
    query += ` ORDER BY priority_score DESC, created_at DESC`;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limitNum, offset);

    const rows = await db.queryAll(query, params);

    const features = rows.map((f) => ({
      id: f.id,
      requirementId: f.requirement_id,
      projectId: f.project_id,
      title: f.title,
      description: f.description,
      status: mapFeatureStatusToFrontend(f.status as FeatureStatus),
      readinessScore: parseFloat(f.readiness_score as string) || 0,
      priorityScore: parseFloat(f.priority_score as string) || 0,
      theme: f.theme,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    }));

    res.json({
      data: features,
      total,
      page: pageNum,
      limit: limitNum,
      hasMore: offset + limitNum < total,
    });
  } catch (error) {
    logger.error('Failed to list features', {
      error: error instanceof Error ? error.message : String(error),
    });
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

    const repo = await getFeatureRepository();
    const feature = await repo.findByIdWithDetails(id);

    if (!feature) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Feature not found',
        },
      });
      return;
    }

    res.json({
      ...feature,
      status: mapFeatureStatusToFrontend(feature.status),
    });
  } catch (error) {
    logger.error('Failed to get feature', {
      error: error instanceof Error ? error.message : String(error),
    });
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

    const repo = await getFeatureRepository();
    const existing = await repo.findById(id);

    if (!existing) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Feature not found',
        },
      });
      return;
    }

    // Map status if provided
    if (updates.status) {
      updates.status = mapStatusToFeatureStatus(updates.status);
    }

    const db = getDatabase();
    const updateFields: string[] = [];
    const updateParams: unknown[] = [];
    let paramIndex = 1;

    const allowedFields = ['title', 'description', 'status', 'theme'];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        const snakeField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
        updateFields.push(`${snakeField} = $${paramIndex++}`);
        updateParams.push(updates[field]);
      }
    }

    if (updateFields.length === 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No valid fields to update',
        },
      });
      return;
    }

    updateFields.push(`updated_at = NOW()`);
    updateParams.push(id);

    const updateQuery = `
      UPDATE features
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.queryOne(updateQuery, updateParams);

    if (result) {
      res.json({
        id: result.id,
        requirementId: result.requirement_id,
        projectId: result.project_id,
        title: result.title,
        description: result.description,
        status: mapFeatureStatusToFrontend(result.status as FeatureStatus),
        readinessScore: parseFloat(result.readiness_score as string) || 0,
        priorityScore: parseFloat(result.priority_score as string) || 0,
        theme: result.theme,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      });
    } else {
      res.status(500).json({
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update feature',
        },
      });
    }
  } catch (error) {
    logger.error('Failed to update feature', {
      error: error instanceof Error ? error.message : String(error),
    });
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

    if (!['pending', 'ready', 'in_progress', 'done'].includes(status)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid status',
        },
      });
      return;
    }

    const repo = await getFeatureRepository();
    const existing = await repo.findById(id);

    if (!existing) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Feature not found',
        },
      });
      return;
    }

    const featureStatus = mapStatusToFeatureStatus(status);
    const updated = await repo.updateStatus(id, featureStatus);

    if (updated) {
      res.json({
        id: updated.id,
        status: mapFeatureStatusToFrontend(updated.status),
        updatedAt: updated.updatedAt,
      });
    } else {
      res.status(500).json({
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update feature status',
        },
      });
    }
  } catch (error) {
    logger.error('Failed to update feature status', {
      error: error instanceof Error ? error.message : String(error),
    });
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

    const repo = await getFeatureRepository();
    const feature = await repo.findById(id);

    if (!feature) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Feature not found',
        },
      });
      return;
    }

    await repo.updateStatus(id, 'in_progress');

    logger.info('Feature approved', { featureId: id });

    res.json({
      id,
      status: 'approved',
      message: 'Feature approved for next loop',
    });
  } catch (error) {
    logger.error('Failed to approve feature', {
      error: error instanceof Error ? error.message : String(error),
    });
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

    if (!questionId || !answer) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'questionId and answer are required',
        },
      });
      return;
    }

    const repo = await getFeatureRepository();
    const feature = await repo.findById(id);

    if (!feature) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Feature not found',
        },
      });
      return;
    }

    const db = getDatabase();

    // Update the clarification question
    const result = await db.queryOne(
      `UPDATE clarification_questions
       SET answer = $1, answered_at = NOW()
       WHERE id = $2 AND feature_id = $3
       RETURNING *`,
      [answer, questionId, id]
    );

    if (!result) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Clarification question not found',
        },
      });
      return;
    }

    // Recalculate readiness score based on answered questions
    const questionStats = await db.queryOne<{ total: string; answered: string }>(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE answer IS NOT NULL) as answered
       FROM clarification_questions
       WHERE feature_id = $1`,
      [id]
    );

    const totalQuestions = parseInt(questionStats?.total || '0', 10);
    const answeredQuestions = parseInt(questionStats?.answered || '0', 10);

    let newReadinessScore = feature.readinessScore;
    if (totalQuestions > 0) {
      // Boost readiness based on answered clarifications
      const clarificationBoost = (answeredQuestions / totalQuestions) * 0.2;
      newReadinessScore = Math.min(1, feature.readinessScore + clarificationBoost);
      await repo.updateReadinessScore(id, newReadinessScore);
    }

    logger.info('Question answered', { featureId: id, questionId });

    res.json({
      featureId: id,
      questionId,
      answered: true,
      newReadinessScore,
      message: 'Question answered',
    });
  } catch (error) {
    logger.error('Failed to answer question', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});
