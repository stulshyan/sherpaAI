// Questions routes for S-038
// Handles clarification question management and answering

import {
  createLogger,
  getDatabase,
  FeatureRepository,
  createReadinessService,
} from '@entropy/shared';
import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express';

const logger = createLogger('questions-routes');

export const questionsRouter: IRouter = Router();

// Initialize services lazily
let featureRepo: FeatureRepository | null = null;
let readinessService: ReturnType<typeof createReadinessService> | null = null;

async function getFeatureRepository() {
  if (!featureRepo) {
    const db = getDatabase();
    await db.connect();
    featureRepo = new FeatureRepository(db);
  }
  return featureRepo;
}

function getReadinessService() {
  if (!readinessService) {
    readinessService = createReadinessService();
  }
  return readinessService;
}

/**
 * GET /api/v1/questions
 * List clarification questions for a feature or requirement
 */
questionsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { featureId, requirementId, unanswered } = req.query;

    if (!featureId && !requirementId) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Either featureId or requirementId is required',
        },
      });
      return;
    }

    const db = getDatabase();

    let query = `
      SELECT cq.*, f.title as feature_title
      FROM clarification_questions cq
      JOIN features f ON f.id = cq.feature_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (featureId) {
      query += ` AND cq.feature_id = $${paramIndex++}`;
      params.push(featureId);
    }

    if (requirementId) {
      query += ` AND f.requirement_id = $${paramIndex++}`;
      params.push(requirementId);
    }

    if (unanswered === 'true') {
      query += ` AND cq.answer IS NULL`;
    }

    query += ` ORDER BY
      CASE cq.priority
        WHEN 'blocking' THEN 1
        WHEN 'important' THEN 2
        ELSE 3
      END,
      cq.created_at ASC`;

    const rows = await db.queryAll(query, params);

    const questions = rows.map((row) => ({
      id: row.id,
      featureId: row.feature_id,
      featureTitle: row.feature_title,
      question: row.question,
      questionType: row.question_type,
      options: row.options,
      answer: row.answer,
      answeredAt: row.answered_at,
      answeredBy: row.answered_by,
      priority: row.priority,
      createdAt: row.created_at,
    }));

    res.json({
      questions,
      total: questions.length,
      unansweredCount: questions.filter((q) => !q.answer).length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/questions/:id
 * Get a specific clarification question
 */
questionsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const row = await db.queryOne(
      `SELECT cq.*, f.title as feature_title, f.requirement_id
       FROM clarification_questions cq
       JOIN features f ON f.id = cq.feature_id
       WHERE cq.id = $1`,
      [id]
    );

    if (!row) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Question ${id} not found`,
        },
      });
      return;
    }

    res.json({
      id: row.id,
      featureId: row.feature_id,
      featureTitle: row.feature_title,
      requirementId: row.requirement_id,
      question: row.question,
      questionType: row.question_type,
      options: row.options,
      answer: row.answer,
      answeredAt: row.answered_at,
      answeredBy: row.answered_by,
      priority: row.priority,
      createdAt: row.created_at,
      _links: {
        self: `/api/v1/questions/${row.id}`,
        feature: `/api/v1/features/${row.feature_id}`,
        answer: `/api/v1/questions/${row.id}/answer`,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/questions/:id/answer
 * Answer a clarification question
 */
questionsRouter.post('/:id/answer', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { answer, notes, attachments } = req.body;

    // Validate answer
    if (!answer) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Answer is required',
          details: { answer: 'required' },
        },
      });
      return;
    }

    const db = getDatabase();
    await db.connect();

    // Get the question
    const questionRow = await db.queryOne(
      `SELECT cq.*, f.id as feature_id, f.requirement_id, f.project_id
       FROM clarification_questions cq
       JOIN features f ON f.id = cq.feature_id
       WHERE cq.id = $1`,
      [id]
    );

    if (!questionRow) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Question ${id} not found`,
        },
      });
      return;
    }

    // Validate answer format for multiple choice
    if (questionRow.question_type === 'multiple_choice') {
      const options = questionRow.options as string[];
      if (!options.includes(answer)) {
        res.status(400).json({
          error: {
            code: 'INVALID_ANSWER',
            message: 'Answer must be one of the provided options',
            details: { validOptions: options },
          },
        });
        return;
      }
    }

    // Validate yes/no answers
    if (questionRow.question_type === 'yes_no') {
      const normalizedAnswer = answer.toLowerCase();
      if (!['yes', 'no', 'true', 'false'].includes(normalizedAnswer)) {
        res.status(400).json({
          error: {
            code: 'INVALID_ANSWER',
            message: 'Answer must be yes or no',
          },
        });
        return;
      }
    }

    // For now, use system user ID - in production this would come from auth
    const userId = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000001';
    const answeredAt = new Date();

    // Update the question with the answer
    await db.query(
      `UPDATE clarification_questions
       SET answer = $1, answered_at = $2, answered_by = $3
       WHERE id = $4`,
      [typeof answer === 'object' ? JSON.stringify(answer) : answer, answeredAt, userId, id]
    );

    // Store notes if provided
    if (notes) {
      // In production, this would be stored in a separate table
      logger.info('Answer notes', { questionId: id, notes });
    }

    // Store attachments if provided
    if (attachments && attachments.length > 0) {
      // In production, this would link S3 keys to the question
      logger.info('Answer attachments', { questionId: id, attachments });
    }

    // Recalculate feature readiness
    const repo = await getFeatureRepository();
    const feature = await repo.findByIdWithDetails(questionRow.feature_id as string);

    let updatedReadinessScore: number | null = null;
    const affectedFeatures: string[] = [questionRow.feature_id as string];

    if (feature) {
      const readiness = getReadinessService();
      const score = readiness.calculateScore(
        {
          id: feature.id,
          title: feature.title,
          description: feature.description,
          childRequirements: feature.atomicRequirements.map((ar) => ar.id),
          dependencies: feature.dependencies.map((d) => d.dependsOnFeatureId),
        },
        feature.atomicRequirements,
        feature.clarificationQuestions
      );

      updatedReadinessScore = score.overall;

      // Update feature readiness in database
      await repo.updateReadinessScore(feature.id, score.overall);
    }

    logger.info('Question answered', {
      questionId: id,
      featureId: questionRow.feature_id,
      priority: questionRow.priority,
      updatedReadinessScore,
    });

    res.json({
      questionId: id,
      answered: true,
      answeredAt: answeredAt.toISOString(),
      affectedFeatures,
      updatedReadinessScores: updatedReadinessScore
        ? { [questionRow.feature_id as string]: updatedReadinessScore }
        : {},
      _links: {
        question: `/api/v1/questions/${id}`,
        feature: `/api/v1/features/${questionRow.feature_id}`,
      },
    });
  } catch (error) {
    logger.error('Failed to answer question', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * DELETE /api/v1/questions/:id/answer
 * Clear an answer (allow re-answering)
 */
questionsRouter.delete('/:id/answer', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    await db.connect();

    // Check question exists
    const exists = await db.queryOne(`SELECT id FROM clarification_questions WHERE id = $1`, [id]);

    if (!exists) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Question ${id} not found`,
        },
      });
      return;
    }

    // Clear the answer
    await db.query(
      `UPDATE clarification_questions
         SET answer = NULL, answered_at = NULL, answered_by = NULL
         WHERE id = $1`,
      [id]
    );

    logger.info('Question answer cleared', { questionId: id });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
