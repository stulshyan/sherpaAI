// Backlog Management System - EPIC E-007
// Complete implementation for S-041 through S-046

import {
  createLogger,
  getDatabase,
  FeatureRepository,
  READINESS_THRESHOLD_LOOP_A,
  READINESS_THRESHOLD_READY_SOON,
  READINESS_THRESHOLD_NEEDS_ATTENTION,
  DEFAULT_WIP_LIMIT,
  DEFAULT_PAGE_SIZE,
} from '@entropy/shared';
import type { BacklogSummary, Feature, FeatureStatus } from '@entropy/shared';
import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express';

const logger = createLogger('backlog-routes');

export const backlogRouter: IRouter = Router();

// Initialize services lazily
let featureRepo: FeatureRepository | null = null;

async function getFeatureRepository(): Promise<FeatureRepository> {
  if (!featureRepo) {
    const db = getDatabase();
    await db.connect();
    featureRepo = new FeatureRepository(db);
  }
  return featureRepo;
}

// ============================================================================
// S-041: Wire backlog routes to FeatureRepository for database-backed views
// ============================================================================

/**
 * GET /api/v1/backlog
 * Get backlog summary with all views for a project
 */
backlogRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
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

    // Fetch all backlog views in parallel
    const [nowPlaying, readySoon, needsAttention, waiting] = await Promise.all([
      repo.getNowPlaying(projectId as string),
      repo.getReadySoon(projectId as string, 10),
      repo.getNeedsAttention(projectId as string),
      repo.getWaiting(projectId as string),
    ]);

    const summary: BacklogSummary = {
      nowPlaying: {
        name: 'Now Playing',
        features: nowPlaying as Feature[],
        count: nowPlaying.length,
      },
      readySoon: {
        name: 'Ready Soon',
        features: readySoon as Feature[],
        count: readySoon.length,
      },
      needsAttention: {
        name: 'Needs Attention',
        features: needsAttention as Feature[],
        count: needsAttention.length,
      },
      waiting: {
        name: 'Waiting',
        features: waiting as Feature[],
        count: waiting.length,
      },
    };

    logger.info('Backlog summary retrieved', {
      projectId,
      nowPlayingCount: nowPlaying.length,
      readySoonCount: readySoon.length,
      needsAttentionCount: needsAttention.length,
      waitingCount: waiting.length,
    });

    res.json({
      ...summary,
      thresholds: {
        loopA: READINESS_THRESHOLD_LOOP_A,
        readySoon: READINESS_THRESHOLD_READY_SOON,
        needsAttention: READINESS_THRESHOLD_NEEDS_ATTENTION,
        wipLimit: DEFAULT_WIP_LIMIT,
      },
      _links: {
        nowPlaying: `/api/v1/backlog/now-playing?projectId=${projectId}`,
        readySoon: `/api/v1/backlog/ready-soon?projectId=${projectId}`,
        needsAttention: `/api/v1/backlog/needs-attention?projectId=${projectId}`,
        waiting: `/api/v1/backlog/waiting?projectId=${projectId}`,
        analytics: `/api/v1/backlog/analytics?projectId=${projectId}`,
        health: `/api/v1/backlog/health?projectId=${projectId}`,
      },
    });
  } catch (error) {
    logger.error('Failed to get backlog summary', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * GET /api/v1/backlog/now-playing
 * Get "Now Playing" features (in progress, up to WIP limit)
 */
backlogRouter.get('/now-playing', async (req: Request, res: Response, next: NextFunction) => {
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
    const features = await repo.getNowPlaying(projectId as string);

    res.json({
      name: 'Now Playing',
      features,
      count: features.length,
      wipLimit: DEFAULT_WIP_LIMIT,
      wipRemaining: Math.max(0, DEFAULT_WIP_LIMIT - features.length),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/backlog/ready-soon
 * Get "Ready Soon" features (high readiness, ready status)
 */
backlogRouter.get('/ready-soon', async (req: Request, res: Response, next: NextFunction) => {
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

    const repo = await getFeatureRepository();
    const limitNum = Math.min(parseInt(limit as string, 10), 50);
    const features = await repo.getReadySoon(projectId as string, limitNum);

    res.json({
      name: 'Ready Soon',
      features,
      count: features.length,
      readinessThreshold: READINESS_THRESHOLD_READY_SOON,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/backlog/needs-attention
 * Get "Needs Attention" features (needs clarification or low readiness)
 */
backlogRouter.get('/needs-attention', async (req: Request, res: Response, next: NextFunction) => {
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
    const features = await repo.getNeedsAttention(projectId as string);

    // Get unanswered question counts for each feature
    const db = getDatabase();
    const questionCounts = await db.queryAll<{ feature_id: string; count: string }>(
      `SELECT feature_id, COUNT(*) as count
       FROM clarification_questions
       WHERE feature_id = ANY($1) AND answer IS NULL
       GROUP BY feature_id`,
      [features.map((f) => f.id)]
    );

    const countMap = new Map(questionCounts.map((r) => [r.feature_id, parseInt(r.count, 10)]));

    const featuresWithQuestionCounts = features.map((f) => ({
      ...f,
      unansweredQuestionCount: countMap.get(f.id) || 0,
    }));

    res.json({
      name: 'Needs Attention',
      features: featuresWithQuestionCounts,
      count: features.length,
      readinessThreshold: READINESS_THRESHOLD_NEEDS_ATTENTION,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/backlog/waiting
 * Get "Waiting" features (draft or blocked)
 */
backlogRouter.get('/waiting', async (req: Request, res: Response, next: NextFunction) => {
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
    const features = await repo.getWaiting(projectId as string);

    // Separate by status for better organization
    const drafts = features.filter((f) => f.status === 'draft');
    const blocked = features.filter((f) => f.status === 'blocked');

    res.json({
      name: 'Waiting',
      features,
      count: features.length,
      breakdown: {
        drafts: drafts.length,
        blocked: blocked.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// S-042: Implement project-scoped backlog summary with filters
// ============================================================================

/**
 * GET /api/v1/backlog/filter
 * Advanced filtering for backlog features
 */
backlogRouter.get('/filter', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      projectId,
      status,
      minReadiness,
      maxReadiness,
      theme,
      loop,
      hasBlockingQuestions,
      page = '1',
      limit = String(DEFAULT_PAGE_SIZE),
      sortBy = 'priorityScore',
      sortOrder = 'desc',
    } = req.query;

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

    // Build dynamic query
    let query = `
      SELECT f.*,
             fr.business_clarity,
             fr.technical_clarity,
             fr.testability,
             (SELECT COUNT(*) FROM clarification_questions cq
              WHERE cq.feature_id = f.id AND cq.answer IS NULL) as unanswered_count
      FROM features f
      LEFT JOIN feature_readiness fr ON fr.feature_id = f.id
      WHERE f.project_id = $1
    `;
    const params: unknown[] = [projectId];
    let paramIndex = 2;

    // Apply filters
    if (status) {
      const statuses = (status as string).split(',');
      query += ` AND f.status = ANY($${paramIndex++})`;
      params.push(statuses);
    }

    if (minReadiness) {
      query += ` AND f.readiness_score >= $${paramIndex++}`;
      params.push(parseFloat(minReadiness as string));
    }

    if (maxReadiness) {
      query += ` AND f.readiness_score <= $${paramIndex++}`;
      params.push(parseFloat(maxReadiness as string));
    }

    if (theme) {
      query += ` AND f.theme = $${paramIndex++}`;
      params.push(theme);
    }

    if (loop) {
      query += ` AND f.current_loop = $${paramIndex++}`;
      params.push(loop);
    }

    if (hasBlockingQuestions === 'true') {
      query += ` AND EXISTS (
        SELECT 1 FROM clarification_questions cq
        WHERE cq.feature_id = f.id AND cq.priority = 'blocking' AND cq.answer IS NULL
      )`;
    }

    // Sorting
    const validSortFields = ['priorityScore', 'readinessScore', 'createdAt', 'updatedAt', 'title'];
    const sortField = validSortFields.includes(sortBy as string)
      ? sortBy === 'priorityScore'
        ? 'priority_score'
        : sortBy === 'readinessScore'
          ? 'readiness_score'
          : sortBy === 'createdAt'
            ? 'created_at'
            : sortBy === 'updatedAt'
              ? 'updated_at'
              : 'title'
      : 'priority_score';

    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortField} ${order}`;

    // Count total before pagination
    const countQuery = query.replace(/SELECT f\.\*.*FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await db.queryOne<{ total: string }>(
      countQuery.split('ORDER BY')[0]!,
      params
    );
    const total = parseInt(countResult?.total || '0', 10);

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offset = (pageNum - 1) * limitNum;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limitNum, offset);

    const rows = await db.queryAll(query, params);

    const features = rows.map((row) => ({
      id: row.id,
      requirementId: row.requirement_id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      status: row.status,
      priorityScore: parseFloat(row.priority_score as string) || 0,
      readinessScore: parseFloat(row.readiness_score as string) || 0,
      theme: row.theme,
      currentLoop: row.current_loop,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      readinessDetails: row.business_clarity
        ? {
            businessClarity: parseFloat(row.business_clarity as string),
            technicalClarity: parseFloat(row.technical_clarity as string),
            testability: parseFloat(row.testability as string),
          }
        : null,
      unansweredQuestionCount: parseInt(row.unanswered_count as string, 10),
    }));

    res.json({
      features,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        hasMore: offset + limitNum < total,
        totalPages: Math.ceil(total / limitNum),
      },
      filters: {
        projectId,
        status: status || null,
        minReadiness: minReadiness ? parseFloat(minReadiness as string) : null,
        maxReadiness: maxReadiness ? parseFloat(maxReadiness as string) : null,
        theme: theme || null,
        loop: loop || null,
        hasBlockingQuestions: hasBlockingQuestions === 'true',
      },
      sort: {
        field: sortBy,
        order: sortOrder,
      },
    });
  } catch (error) {
    logger.error('Failed to filter backlog', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

// ============================================================================
// S-043: Add pagination, sorting, and search to backlog views
// ============================================================================

/**
 * GET /api/v1/backlog/search
 * Search features in backlog
 */
backlogRouter.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, q, page = '1', limit = String(DEFAULT_PAGE_SIZE) } = req.query;

    if (!projectId) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'projectId query parameter is required',
        },
      });
      return;
    }

    if (!q || (q as string).trim().length < 2) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Search query (q) must be at least 2 characters',
        },
      });
      return;
    }

    const db = getDatabase();
    await db.connect();

    const searchTerm = `%${(q as string).toLowerCase()}%`;
    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    // Search in title, description, and theme
    const query = `
      SELECT f.*,
             ts_rank(to_tsvector('english', COALESCE(f.title, '') || ' ' || COALESCE(f.description, '')),
                     plainto_tsquery('english', $2)) as rank
      FROM features f
      WHERE f.project_id = $1
        AND (LOWER(f.title) LIKE $3
             OR LOWER(f.description) LIKE $3
             OR LOWER(f.theme) LIKE $3)
      ORDER BY rank DESC, f.priority_score DESC
      LIMIT $4 OFFSET $5
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM features f
      WHERE f.project_id = $1
        AND (LOWER(f.title) LIKE $2
             OR LOWER(f.description) LIKE $2
             OR LOWER(f.theme) LIKE $2)
    `;

    const [rows, countResult] = await Promise.all([
      db.queryAll(query, [projectId, q, searchTerm, limitNum, offset]),
      db.queryOne<{ total: string }>(countQuery, [projectId, searchTerm]),
    ]);

    const total = parseInt(countResult?.total || '0', 10);

    const features = rows.map((row) => ({
      id: row.id,
      requirementId: row.requirement_id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      status: row.status,
      priorityScore: parseFloat(row.priority_score as string) || 0,
      readinessScore: parseFloat(row.readiness_score as string) || 0,
      theme: row.theme,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      relevanceScore: parseFloat(row.rank as string) || 0,
    }));

    res.json({
      query: q,
      features,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        hasMore: offset + limitNum < total,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// S-044: Implement backlog analytics and statistics endpoints
// ============================================================================

/**
 * GET /api/v1/backlog/analytics
 * Get backlog analytics and statistics
 */
backlogRouter.get('/analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, startDate, endDate } = req.query;

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

    // Date range filter
    const start = startDate
      ? new Date(startDate as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Get status counts
    const statusCounts = await db.queryAll<{ status: string; count: string }>(
      `SELECT status, COUNT(*) as count FROM features WHERE project_id = $1 GROUP BY status`,
      [projectId]
    );

    // Get readiness distribution
    const readinessDistribution = await db.queryAll<{ bucket: string; count: string }>(
      `SELECT
         CASE
           WHEN readiness_score >= 0.8 THEN 'high'
           WHEN readiness_score >= 0.5 THEN 'medium'
           WHEN readiness_score >= 0.2 THEN 'low'
           ELSE 'critical'
         END as bucket,
         COUNT(*) as count
       FROM features
       WHERE project_id = $1
       GROUP BY bucket`,
      [projectId]
    );

    // Get completion velocity (features completed in date range)
    const completedInRange = await db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM features
       WHERE project_id = $1
         AND status = 'completed'
         AND updated_at >= $2
         AND updated_at <= $3`,
      [projectId, start, end]
    );

    // Get average readiness score
    const avgReadiness = await db.queryOne<{ avg: string }>(
      `SELECT AVG(readiness_score) as avg FROM features WHERE project_id = $1`,
      [projectId]
    );

    // Get theme distribution
    const themeDistribution = await db.queryAll<{ theme: string; count: string }>(
      `SELECT COALESCE(theme, 'Uncategorized') as theme, COUNT(*) as count
       FROM features WHERE project_id = $1 GROUP BY theme ORDER BY count DESC LIMIT 10`,
      [projectId]
    );

    // Get loop stage distribution
    const loopDistribution = await db.queryAll<{ loop: string; count: string }>(
      `SELECT COALESCE(current_loop, 'loop_0') as loop, COUNT(*) as count
       FROM features WHERE project_id = $1 GROUP BY loop`,
      [projectId]
    );

    // Get blocking question count
    const blockingQuestionsCount = await db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM clarification_questions cq
       JOIN features f ON f.id = cq.feature_id
       WHERE f.project_id = $1 AND cq.priority = 'blocking' AND cq.answer IS NULL`,
      [projectId]
    );

    // Get features created over time (last 30 days)
    const createdOverTime = await db.queryAll<{ date: string; count: string }>(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM features
       WHERE project_id = $1 AND created_at >= $2
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [projectId, start]
    );

    res.json({
      projectId,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      summary: {
        totalFeatures: statusCounts.reduce((sum, r) => sum + parseInt(r.count, 10), 0),
        averageReadiness: parseFloat(avgReadiness?.avg || '0'),
        completedInRange: parseInt(completedInRange?.count || '0', 10),
        blockingQuestions: parseInt(blockingQuestionsCount?.count || '0', 10),
      },
      distributions: {
        byStatus: Object.fromEntries(statusCounts.map((r) => [r.status, parseInt(r.count, 10)])),
        byReadiness: Object.fromEntries(
          readinessDistribution.map((r) => [r.bucket, parseInt(r.count, 10)])
        ),
        byTheme: Object.fromEntries(themeDistribution.map((r) => [r.theme, parseInt(r.count, 10)])),
        byLoop: Object.fromEntries(loopDistribution.map((r) => [r.loop, parseInt(r.count, 10)])),
      },
      trends: {
        createdOverTime: createdOverTime.map((r) => ({
          date: r.date,
          count: parseInt(r.count, 10),
        })),
      },
    });
  } catch (error) {
    logger.error('Failed to get backlog analytics', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * GET /api/v1/backlog/velocity
 * Get team velocity metrics
 */
backlogRouter.get('/velocity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, weeks = '4' } = req.query;

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

    const weeksNum = Math.min(parseInt(weeks as string, 10), 12);
    const startDate = new Date(Date.now() - weeksNum * 7 * 24 * 60 * 60 * 1000);

    // Get weekly completion counts
    const weeklyVelocity = await db.queryAll<{ week: string; completed: string; started: string }>(
      `SELECT
         DATE_TRUNC('week', updated_at)::date as week,
         COUNT(*) FILTER (WHERE status = 'completed') as completed,
         COUNT(*) FILTER (WHERE status = 'in_progress') as started
       FROM features
       WHERE project_id = $1 AND updated_at >= $2
       GROUP BY week
       ORDER BY week`,
      [projectId, startDate]
    );

    // Calculate averages
    const completedCounts = weeklyVelocity.map((w) => parseInt(w.completed, 10));
    const avgVelocity =
      completedCounts.length > 0
        ? completedCounts.reduce((a, b) => a + b, 0) / completedCounts.length
        : 0;

    // Get current WIP
    const wipCount = await db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM features WHERE project_id = $1 AND status = 'in_progress'`,
      [projectId]
    );

    // Get backlog size
    const backlogSize = await db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM features
       WHERE project_id = $1 AND status NOT IN ('completed', 'cancelled')`,
      [projectId]
    );

    res.json({
      projectId,
      period: {
        weeks: weeksNum,
        startDate: startDate.toISOString(),
      },
      velocity: {
        weeklyData: weeklyVelocity.map((w) => ({
          week: w.week,
          completed: parseInt(w.completed, 10),
          started: parseInt(w.started, 10),
        })),
        average: Math.round(avgVelocity * 10) / 10,
        trend:
          completedCounts.length >= 2
            ? completedCounts[completedCounts.length - 1]! > completedCounts[0]!
              ? 'increasing'
              : completedCounts[completedCounts.length - 1]! < completedCounts[0]!
                ? 'decreasing'
                : 'stable'
            : 'insufficient_data',
      },
      currentState: {
        wip: parseInt(wipCount?.count || '0', 10),
        wipLimit: DEFAULT_WIP_LIMIT,
        backlogSize: parseInt(backlogSize?.count || '0', 10),
        estimatedWeeksToComplete:
          avgVelocity > 0 ? Math.ceil(parseInt(backlogSize?.count || '0', 10) / avgVelocity) : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// S-045: Add loop progression workflow and status transitions
// ============================================================================

/**
 * POST /api/v1/backlog/features/:id/promote
 * Promote feature to next loop stage
 */
backlogRouter.post(
  '/features/:id/promote',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { targetLoop, force = false } = req.body;

      if (!id) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Feature ID is required',
          },
        });
        return;
      }

      const repo = await getFeatureRepository();
      const featureEntity = await repo.findById(id);

      if (!featureEntity) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Feature ${id} not found`,
          },
        });
        return;
      }

      // Get full details for blocking questions check
      const featureDetails = await repo.findByIdWithDetails(id);

      // Define loop progression rules
      const loopOrder = ['loop_0', 'loop_a', 'loop_b', 'loop_c'];
      const currentLoop = featureEntity.currentLoop || 'loop_0';
      const currentLoopIndex = loopOrder.indexOf(currentLoop);
      const nextLoop = targetLoop || loopOrder[currentLoopIndex + 1];

      if (!nextLoop || !loopOrder.includes(nextLoop)) {
        res.status(400).json({
          error: {
            code: 'INVALID_LOOP',
            message: 'Invalid target loop stage',
            validLoops: loopOrder,
          },
        });
        return;
      }

      // Check if feature meets readiness requirements
      const readinessRequirements: Record<string, number> = {
        loop_a: READINESS_THRESHOLD_LOOP_A,
        loop_b: 0.8,
        loop_c: 0.9,
      };

      const requiredReadiness = readinessRequirements[nextLoop] || 0;

      if (featureEntity.readinessScore < requiredReadiness && !force) {
        const blockingQuestions = featureDetails?.clarificationQuestions.filter(
          (q) => !q.answer && q.priority === 'blocking'
        ) || [];
        res.status(400).json({
          error: {
            code: 'INSUFFICIENT_READINESS',
            message: `Feature readiness (${featureEntity.readinessScore.toFixed(2)}) below threshold (${requiredReadiness})`,
            currentReadiness: featureEntity.readinessScore,
            requiredReadiness,
            blockingQuestions,
          },
        });
        return;
      }

      // Check for blocking dependencies
      const blockingDeps = featureDetails?.dependencies.filter((d) => d.dependencyType === 'blocks') || [];
      if (blockingDeps.length > 0 && !force) {
        // Check if blocking features are completed
        const db = getDatabase();
        const incompleteBlockers = await db.queryAll<{ id: string; title: string; status: string }>(
          `SELECT id, title, status FROM features
         WHERE id = ANY($1) AND status != 'completed'`,
          [blockingDeps.map((d) => d.dependsOnFeatureId)]
        );

        if (incompleteBlockers.length > 0) {
          res.status(400).json({
            error: {
              code: 'BLOCKING_DEPENDENCIES',
              message: 'Feature has incomplete blocking dependencies',
              blockedBy: incompleteBlockers,
            },
          });
          return;
        }
      }

      // Create approval record
      const db = getDatabase();
      const userId = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000001';

      await db.query(
        `INSERT INTO approvals (feature_id, approval_type, status, approved_by, approved_at, notes)
       VALUES ($1, 'loop_promotion', 'approved', $2, NOW(), $3)`,
        [id, userId, `Promoted to ${nextLoop}${force ? ' (forced)' : ''}`]
      );

      // Update feature loop
      await db.query(
        `UPDATE features SET current_loop = $1, status = 'in_progress', updated_at = NOW() WHERE id = $2`,
        [nextLoop, id]
      );

      logger.info('Feature promoted', {
        featureId: id,
        fromLoop: currentLoop,
        toLoop: nextLoop,
        forced: force,
      });

      res.json({
        featureId: id,
        promoted: true,
        previousLoop: currentLoop,
        currentLoop: nextLoop,
        message: `Feature promoted to ${nextLoop}`,
      });
    } catch (error) {
      logger.error('Failed to promote feature', {
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
);

/**
 * POST /api/v1/backlog/features/:id/transition
 * Transition feature status
 */
backlogRouter.post(
  '/features/:id/transition',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;

      if (!id) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Feature ID is required',
          },
        });
        return;
      }

      if (!status) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Status is required',
          },
        });
        return;
      }

      const validStatuses: FeatureStatus[] = [
        'draft',
        'needs_clarification',
        'ready',
        'in_progress',
        'completed',
        'blocked',
        'cancelled',
      ];

      if (!validStatuses.includes(status)) {
        res.status(400).json({
          error: {
            code: 'INVALID_STATUS',
            message: 'Invalid status',
            validStatuses,
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
            message: `Feature ${id} not found`,
          },
        });
        return;
      }

      // Define valid transitions
      const validTransitions: Record<FeatureStatus, FeatureStatus[]> = {
        draft: ['needs_clarification', 'ready', 'cancelled'],
        needs_clarification: ['draft', 'ready', 'blocked', 'cancelled'],
        ready: ['in_progress', 'needs_clarification', 'blocked', 'cancelled'],
        in_progress: ['ready', 'completed', 'blocked', 'cancelled'],
        completed: ['in_progress'], // Allow reopening
        blocked: ['draft', 'needs_clarification', 'ready', 'cancelled'],
        cancelled: ['draft'], // Allow revival
      };

      const allowedTransitions = validTransitions[feature.status] || [];
      if (!allowedTransitions.includes(status)) {
        res.status(400).json({
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot transition from ${feature.status} to ${status}`,
            allowedTransitions,
          },
        });
        return;
      }

      // Check WIP limit for in_progress transitions
      if (status === 'in_progress') {
        const currentWip = await repo.getNowPlaying(feature.projectId);
        if (currentWip.length >= DEFAULT_WIP_LIMIT) {
          res.status(400).json({
            error: {
              code: 'WIP_LIMIT_EXCEEDED',
              message: `Cannot start more work. WIP limit (${DEFAULT_WIP_LIMIT}) reached.`,
              currentWip: currentWip.length,
              wipLimit: DEFAULT_WIP_LIMIT,
            },
          });
          return;
        }
      }

      const previousStatus = feature.status;

      // Update status
      const actor = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000001';
      await repo.updateStatus(id, status, { actor });

      logger.info('Feature status transitioned', {
        featureId: id,
        from: previousStatus,
        to: status,
        reason,
      });

      res.json({
        featureId: id,
        previousStatus,
        currentStatus: status,
        transitionedAt: new Date().toISOString(),
        reason,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/backlog/ready-for-promotion
 * Get features ready for loop promotion
 */
backlogRouter.get(
  '/ready-for-promotion',
  async (req: Request, res: Response, next: NextFunction) => {
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

      // Get features in each loop that might be ready for next
      const db = getDatabase();
      const featuresInLoops = await db.queryAll(
        `SELECT f.*,
              COALESCE(f.current_loop, 'loop_0') as loop,
              (SELECT COUNT(*) FROM feature_dependencies fd
               JOIN features fb ON fb.id = fd.depends_on_feature_id
               WHERE fd.feature_id = f.id
                 AND fd.dependency_type = 'blocks'
                 AND fb.status != 'completed') as blocking_count
       FROM features f
       WHERE f.project_id = $1
         AND f.status = 'ready'
         AND f.readiness_score >= $2
       ORDER BY f.priority_score DESC`,
        [projectId, READINESS_THRESHOLD_LOOP_A]
      );

      const candidates = featuresInLoops.map((row) => ({
        id: row.id,
        title: row.title,
        currentLoop: row.loop,
        readinessScore: parseFloat(row.readiness_score as string),
        priorityScore: parseFloat(row.priority_score as string),
        blockingDependencies: parseInt(row.blocking_count as string, 10),
        isReady: parseInt(row.blocking_count as string, 10) === 0,
      }));

      res.json({
        projectId,
        candidates,
        summary: {
          total: candidates.length,
          readyNow: candidates.filter((c) => c.isReady).length,
          blocked: candidates.filter((c) => !c.isReady).length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// S-046: Implement backlog health metrics and export
// ============================================================================

/**
 * GET /api/v1/backlog/health
 * Get backlog health metrics
 */
backlogRouter.get('/health', async (req: Request, res: Response, next: NextFunction) => {
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

    const db = getDatabase();
    await db.connect();

    // Get various health metrics
    const [
      totalFeatures,
      statusBreakdown,
      avgReadiness,
      staleFeatures,
      blockingQuestions,
      circularDeps,
      overdueItems,
    ] = await Promise.all([
      // Total features
      db.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM features WHERE project_id = $1`,
        [projectId]
      ),
      // Status breakdown
      db.queryAll<{ status: string; count: string }>(
        `SELECT status, COUNT(*) as count FROM features WHERE project_id = $1 GROUP BY status`,
        [projectId]
      ),
      // Average readiness
      db.queryOne<{ avg: string; min: string; max: string }>(
        `SELECT AVG(readiness_score) as avg, MIN(readiness_score) as min, MAX(readiness_score) as max
         FROM features WHERE project_id = $1 AND status NOT IN ('completed', 'cancelled')`,
        [projectId]
      ),
      // Stale features (not updated in 14 days)
      db.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM features
         WHERE project_id = $1
           AND status NOT IN ('completed', 'cancelled')
           AND updated_at < NOW() - INTERVAL '14 days'`,
        [projectId]
      ),
      // Blocking questions
      db.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM clarification_questions cq
         JOIN features f ON f.id = cq.feature_id
         WHERE f.project_id = $1 AND cq.priority = 'blocking' AND cq.answer IS NULL`,
        [projectId]
      ),
      // Check for circular dependencies (simplified check)
      db.queryAll<{ id: string }>(
        `WITH RECURSIVE dep_chain AS (
           SELECT feature_id, depends_on_feature_id, ARRAY[feature_id] as path
           FROM feature_dependencies
           WHERE dependency_type = 'blocks'
           UNION ALL
           SELECT fd.feature_id, fd.depends_on_feature_id, dc.path || fd.feature_id
           FROM feature_dependencies fd
           JOIN dep_chain dc ON fd.feature_id = dc.depends_on_feature_id
           WHERE NOT fd.feature_id = ANY(dc.path)
             AND array_length(dc.path, 1) < 10
         )
         SELECT DISTINCT dc.feature_id as id
         FROM dep_chain dc
         JOIN features f ON f.id = dc.feature_id
         WHERE f.project_id = $1
           AND dc.depends_on_feature_id = ANY(dc.path)`,
        [projectId]
      ),
      // Features in progress for too long (>7 days)
      db.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM features
         WHERE project_id = $1
           AND status = 'in_progress'
           AND updated_at < NOW() - INTERVAL '7 days'`,
        [projectId]
      ),
    ]);

    // Calculate health score (0-100)
    const total = parseInt(totalFeatures?.count || '0', 10);
    const stale = parseInt(staleFeatures?.count || '0', 10);
    const blocking = parseInt(blockingQuestions?.count || '0', 10);
    const circular = circularDeps.length;
    const overdue = parseInt(overdueItems?.count || '0', 10);
    const avgReady = parseFloat(avgReadiness?.avg || '0');

    let healthScore = 100;
    // Deduct for stale features
    healthScore -= Math.min(20, (stale / Math.max(total, 1)) * 100);
    // Deduct for blocking questions
    healthScore -= Math.min(25, blocking * 5);
    // Deduct for circular dependencies
    healthScore -= circular * 10;
    // Deduct for overdue items
    healthScore -= Math.min(15, overdue * 3);
    // Boost for high average readiness
    healthScore += (avgReady - 0.5) * 20;

    healthScore = Math.max(0, Math.min(100, healthScore));

    const healthStatus = healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical';

    const issues: Array<{ type: string; severity: string; message: string; count: number }> = [];

    if (stale > 0) {
      issues.push({
        type: 'stale_features',
        severity: stale > 5 ? 'high' : 'medium',
        message: `${stale} features haven't been updated in 14+ days`,
        count: stale,
      });
    }

    if (blocking > 0) {
      issues.push({
        type: 'blocking_questions',
        severity: 'high',
        message: `${blocking} blocking questions need answers`,
        count: blocking,
      });
    }

    if (circular > 0) {
      issues.push({
        type: 'circular_dependencies',
        severity: 'critical',
        message: `${circular} features have circular dependencies`,
        count: circular,
      });
    }

    if (overdue > 0) {
      issues.push({
        type: 'overdue_wip',
        severity: 'medium',
        message: `${overdue} in-progress items haven't progressed in 7+ days`,
        count: overdue,
      });
    }

    res.json({
      projectId,
      health: {
        score: Math.round(healthScore),
        status: healthStatus,
        lastCalculated: new Date().toISOString(),
      },
      metrics: {
        totalFeatures: total,
        averageReadiness: parseFloat(avgReady.toFixed(3)),
        readinessRange: {
          min: parseFloat(avgReadiness?.min || '0'),
          max: parseFloat(avgReadiness?.max || '0'),
        },
        statusBreakdown: Object.fromEntries(
          statusBreakdown.map((r) => [r.status, parseInt(r.count, 10)])
        ),
      },
      issues,
      recommendations: generateRecommendations(issues, avgReady, total),
    });
  } catch (error) {
    logger.error('Failed to get backlog health', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * Generate recommendations based on health issues
 */
function generateRecommendations(
  issues: Array<{ type: string; severity: string; count: number }>,
  avgReadiness: number,
  totalFeatures: number
): string[] {
  const recommendations: string[] = [];

  for (const issue of issues) {
    switch (issue.type) {
      case 'stale_features':
        recommendations.push('Review and update stale features or mark them as blocked/cancelled');
        break;
      case 'blocking_questions':
        recommendations.push(
          'Prioritize answering blocking clarification questions to unblock progress'
        );
        break;
      case 'circular_dependencies':
        recommendations.push('Resolve circular dependencies by reviewing feature relationships');
        break;
      case 'overdue_wip':
        recommendations.push('Check on in-progress items that may be stuck and need help');
        break;
    }
  }

  if (avgReadiness < 0.5 && totalFeatures > 0) {
    recommendations.push(
      'Focus on improving feature readiness by answering clarification questions'
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('Backlog is healthy! Continue regular grooming to maintain quality.');
  }

  return recommendations;
}

/**
 * GET /api/v1/backlog/export
 * Export backlog data in various formats
 */
backlogRouter.get('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, format = 'json', includeQuestions = 'true' } = req.query;

    if (!projectId) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'projectId query parameter is required',
        },
      });
      return;
    }

    const validFormats = ['json', 'csv'];
    if (!validFormats.includes(format as string)) {
      res.status(400).json({
        error: {
          code: 'INVALID_FORMAT',
          message: 'Invalid export format',
          validFormats,
        },
      });
      return;
    }

    const db = getDatabase();
    await db.connect();

    // Get all features with details
    const query = `
      SELECT f.*,
             fr.business_clarity,
             fr.technical_clarity,
             fr.testability,
             r.title as requirement_title
      FROM features f
      LEFT JOIN feature_readiness fr ON fr.feature_id = f.id
      LEFT JOIN requirements r ON r.id = f.requirement_id
      WHERE f.project_id = $1
      ORDER BY f.priority_score DESC, f.created_at DESC
    `;

    const features = await db.queryAll(query, [projectId]);

    let questions: Array<Record<string, unknown>> = [];
    if (includeQuestions === 'true') {
      questions = await db.queryAll(
        `SELECT cq.*, f.title as feature_title
         FROM clarification_questions cq
         JOIN features f ON f.id = cq.feature_id
         WHERE f.project_id = $1
         ORDER BY f.id, cq.priority`,
        [projectId]
      );
    }

    if (format === 'csv') {
      // Generate CSV
      const csvHeaders = [
        'ID',
        'Title',
        'Description',
        'Status',
        'Priority Score',
        'Readiness Score',
        'Theme',
        'Current Loop',
        'Requirement',
        'Business Clarity',
        'Technical Clarity',
        'Testability',
        'Created At',
        'Updated At',
      ];

      const csvRows = features.map((f) =>
        [
          f.id,
          `"${((f.title as string) || '').replace(/"/g, '""')}"`,
          `"${((f.description as string) || '').replace(/"/g, '""')}"`,
          f.status,
          f.priority_score,
          f.readiness_score,
          f.theme || '',
          f.current_loop || 'loop_0',
          f.requirement_title || '',
          f.business_clarity || '',
          f.technical_clarity || '',
          f.testability || '',
          f.created_at,
          f.updated_at,
        ].join(',')
      );

      const csv = [csvHeaders.join(','), ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=backlog-${projectId}.csv`);
      res.send(csv);
      return;
    }

    // JSON format (default)
    const exportData = {
      exportedAt: new Date().toISOString(),
      projectId,
      featureCount: features.length,
      features: features.map((f) => ({
        id: f.id,
        requirementId: f.requirement_id,
        requirementTitle: f.requirement_title,
        title: f.title,
        description: f.description,
        status: f.status,
        priorityScore: parseFloat(f.priority_score as string) || 0,
        readinessScore: parseFloat(f.readiness_score as string) || 0,
        theme: f.theme,
        currentLoop: f.current_loop || 'loop_0',
        readinessDetails: f.business_clarity
          ? {
              businessClarity: parseFloat(f.business_clarity as string),
              technicalClarity: parseFloat(f.technical_clarity as string),
              testability: parseFloat(f.testability as string),
            }
          : null,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
      })),
      ...(includeQuestions === 'true' && {
        questionCount: questions.length,
        questions: questions.map((q) => ({
          id: q.id,
          featureId: q.feature_id,
          featureTitle: q.feature_title,
          question: q.question,
          questionType: q.question_type,
          priority: q.priority,
          answer: q.answer,
          answeredAt: q.answered_at,
        })),
      }),
    };

    res.json(exportData);
  } catch (error) {
    logger.error('Failed to export backlog', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * GET /api/v1/backlog/report
 * Generate a comprehensive backlog report
 */
backlogRouter.get('/report', async (req: Request, res: Response, next: NextFunction) => {
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
    const db = getDatabase();
    await db.connect();

    // Get all backlog data
    const [
      nowPlaying,
      readySoon,
      needsAttention,
      waiting,
      statusCounts,
      avgReadiness,
      unansweredQuestions,
      recentActivity,
    ] = await Promise.all([
      repo.getNowPlaying(projectId as string),
      repo.getReadySoon(projectId as string, 5),
      repo.getNeedsAttention(projectId as string),
      repo.getWaiting(projectId as string),
      repo.countByStatusForProject(projectId as string),
      db.queryOne<{ avg: string }>(
        `SELECT AVG(readiness_score) as avg FROM features
         WHERE project_id = $1 AND status NOT IN ('completed', 'cancelled')`,
        [projectId]
      ),
      db.queryAll(
        `SELECT cq.*, f.title as feature_title
         FROM clarification_questions cq
         JOIN features f ON f.id = cq.feature_id
         WHERE f.project_id = $1 AND cq.answer IS NULL
         ORDER BY cq.priority, cq.created_at
         LIMIT 10`,
        [projectId]
      ),
      db.queryAll(
        `SELECT id, title, status, updated_at
         FROM features
         WHERE project_id = $1
         ORDER BY updated_at DESC
         LIMIT 10`,
        [projectId]
      ),
    ]);

    const report = {
      generatedAt: new Date().toISOString(),
      projectId,
      executive_summary: {
        totalFeatures: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        averageReadiness: parseFloat(avgReadiness?.avg || '0').toFixed(2),
        inProgress: statusCounts.in_progress,
        readyToStart: readySoon.length,
        needingAttention: needsAttention.length,
        blockedOrDraft: waiting.length,
      },
      current_sprint: {
        nowPlaying: nowPlaying.map((f) => ({
          id: f.id,
          title: f.title,
          readinessScore: f.readinessScore,
          priorityScore: f.priorityScore,
        })),
        wipUtilization: `${nowPlaying.length}/${DEFAULT_WIP_LIMIT}`,
      },
      ready_pipeline: {
        count: readySoon.length,
        topCandidates: readySoon.slice(0, 5).map((f) => ({
          id: f.id,
          title: f.title,
          readinessScore: f.readinessScore,
        })),
      },
      attention_required: {
        count: needsAttention.length,
        unansweredQuestions: unansweredQuestions.map((q) => ({
          id: q.id,
          featureTitle: q.feature_title,
          question: q.question,
          priority: q.priority,
        })),
      },
      status_breakdown: statusCounts,
      recent_activity: recentActivity.map((f) => ({
        id: f.id,
        title: f.title,
        status: f.status,
        updatedAt: f.updated_at,
      })),
    };

    res.json(report);
  } catch (error) {
    logger.error('Failed to generate backlog report', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});
