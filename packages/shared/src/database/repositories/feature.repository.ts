// Repository for Feature entity

import { QueryResultRow } from 'pg';
import {
  READINESS_THRESHOLD_LOOP_A,
  READINESS_THRESHOLD_READY_SOON,
  READINESS_THRESHOLD_NEEDS_ATTENTION,
  DEFAULT_WIP_LIMIT,
} from '../../constants/index.js';
import type { UUID, PaginationParams } from '../../types/common.js';
import type {
  Feature,
  FeatureStatus,
  FeatureReadiness,
  FeatureDependency,
  FeatureWithDetails,
  DependencyType,
} from '../../types/feature.js';
import type { ClarificationQuestion } from '../../types/requirement.js';
import {
  BaseRepository,
  AuditContext,
  rowToEntityBase,
  entityToRowBase,
} from '../base-repository.js';
import { DatabaseClient } from '../client.js';

/**
 * Database row type for features
 */
interface FeatureRow extends QueryResultRow {
  id: string;
  requirement_id: string | null;
  project_id: string;
  parent_feature_id: string | null;
  title: string;
  description: string | null;
  feature_type: string | null;
  status: string;
  priority_score: string;
  readiness_score: string;
  complexity_score: string | null;
  business_value: string | null;
  urgency_score: string | null;
  version: number;
  current_loop: string | null;
  theme: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Extended feature interface for database operations
 */
export interface FeatureEntity extends Feature {
  featureType?: string;
  complexityScore?: number;
  businessValue?: number;
  urgencyScore?: number;
  version: number;
  currentLoop?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating a new feature
 */
export interface CreateFeatureInput {
  requirementId?: UUID;
  projectId: UUID;
  parentFeatureId?: UUID;
  title: string;
  description?: string;
  featureType?: string;
  theme?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Repository for managing Feature entities
 */
export class FeatureRepository extends BaseRepository<FeatureEntity> {
  protected rowToEntity = (row: QueryResultRow): FeatureEntity => {
    const typedRow = row as FeatureRow;
    const base = rowToEntityBase(row) as unknown as FeatureEntity;
    return {
      ...base,
      status: typedRow.status as FeatureStatus,
      priorityScore: parseFloat(typedRow.priority_score) || 0,
      readinessScore: parseFloat(typedRow.readiness_score) || 0,
      complexityScore: typedRow.complexity_score ? parseFloat(typedRow.complexity_score) : undefined,
      businessValue: typedRow.business_value ? parseFloat(typedRow.business_value) : undefined,
      urgencyScore: typedRow.urgency_score ? parseFloat(typedRow.urgency_score) : undefined,
    };
  };

  protected entityToRow = (entity: Partial<FeatureEntity>): Record<string, unknown> => {
    const row = entityToRowBase(entity as Record<string, unknown>);
    // Handle JSON fields
    if (entity.metadata !== undefined) {
      row.metadata = JSON.stringify(entity.metadata);
    }
    return row;
  };

  constructor(db: DatabaseClient) {
    super(db, 'features');
  }

  /**
   * Create a new feature
   */
  async createFeature(
    input: CreateFeatureInput,
    audit?: AuditContext
  ): Promise<FeatureEntity> {
    const data = {
      requirementId: input.requirementId,
      projectId: input.projectId,
      parentFeatureId: input.parentFeatureId,
      title: input.title,
      description: input.description || '',
      featureType: input.featureType,
      theme: input.theme,
      metadata: input.metadata,
      status: 'draft' as FeatureStatus,
      priorityScore: 0,
      readinessScore: 0,
      version: 1,
    };

    if (audit) {
      return this.createWithAudit(data as Omit<FeatureEntity, 'id' | 'createdAt' | 'updatedAt'>, audit);
    }
    return this.create(data as Omit<FeatureEntity, 'id' | 'createdAt' | 'updatedAt'>);
  }

  /**
   * Create multiple features from decomposition
   */
  async createFromDecomposition(
    features: CreateFeatureInput[],
    audit?: AuditContext
  ): Promise<FeatureEntity[]> {
    const results: FeatureEntity[] = [];

    for (const input of features) {
      const feature = await this.createFeature(input, audit);
      results.push(feature);
    }

    return results;
  }

  /**
   * Find features by project ID
   */
  async findByProjectId(
    projectId: UUID,
    pagination?: PaginationParams
  ): Promise<FeatureEntity[]> {
    let query = `
      SELECT * FROM features
      WHERE project_id = $1
      ORDER BY priority_score DESC, created_at DESC
    `;

    const params: unknown[] = [projectId];

    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query += ` LIMIT $2 OFFSET $3`;
      params.push(pagination.limit, offset);
    }

    const rows = await this.db.queryAll<FeatureRow>(query, params);
    return rows.map(this.rowToEntity);
  }

  /**
   * Find features by requirement ID
   */
  async findByRequirementId(requirementId: UUID): Promise<FeatureEntity[]> {
    const rows = await this.db.queryAll<FeatureRow>(
      `SELECT * FROM features WHERE requirement_id = $1 ORDER BY priority_score DESC`,
      [requirementId]
    );
    return rows.map(this.rowToEntity);
  }

  /**
   * Find features by status
   */
  async findByStatus(
    projectId: UUID,
    status: FeatureStatus
  ): Promise<FeatureEntity[]> {
    const rows = await this.db.queryAll<FeatureRow>(
      `SELECT * FROM features WHERE project_id = $1 AND status = $2 ORDER BY priority_score DESC`,
      [projectId, status]
    );
    return rows.map(this.rowToEntity);
  }

  /**
   * Find features ready for Loop A (high readiness, status = 'ready')
   */
  async findReadyForLoopA(
    projectId: UUID,
    limit: number = 10
  ): Promise<FeatureEntity[]> {
    const rows = await this.db.queryAll<FeatureRow>(
      `SELECT * FROM features
       WHERE project_id = $1
         AND status = 'ready'
         AND readiness_score >= $2
       ORDER BY priority_score DESC
       LIMIT $3`,
      [projectId, READINESS_THRESHOLD_LOOP_A, limit]
    );
    return rows.map(this.rowToEntity);
  }

  /**
   * Get Now Playing features (in progress, up to WIP limit)
   */
  async getNowPlaying(projectId: UUID): Promise<FeatureEntity[]> {
    const rows = await this.db.queryAll<FeatureRow>(
      `SELECT * FROM features
       WHERE project_id = $1
         AND status = 'in_progress'
       ORDER BY priority_score DESC
       LIMIT $2`,
      [projectId, DEFAULT_WIP_LIMIT]
    );
    return rows.map(this.rowToEntity);
  }

  /**
   * Get Ready Soon features (ready, high readiness)
   */
  async getReadySoon(projectId: UUID, limit: number = 10): Promise<FeatureEntity[]> {
    const rows = await this.db.queryAll<FeatureRow>(
      `SELECT * FROM features
       WHERE project_id = $1
         AND status = 'ready'
         AND readiness_score >= $2
       ORDER BY priority_score DESC
       LIMIT $3`,
      [projectId, READINESS_THRESHOLD_READY_SOON, limit]
    );
    return rows.map(this.rowToEntity);
  }

  /**
   * Get Needs Attention features (needs_clarification or low readiness)
   */
  async getNeedsAttention(projectId: UUID): Promise<FeatureEntity[]> {
    const rows = await this.db.queryAll<FeatureRow>(
      `SELECT * FROM features
       WHERE project_id = $1
         AND (status = 'needs_clarification' OR readiness_score < $2)
       ORDER BY priority_score DESC`,
      [projectId, READINESS_THRESHOLD_NEEDS_ATTENTION]
    );
    return rows.map(this.rowToEntity);
  }

  /**
   * Get Waiting features (draft or blocked)
   */
  async getWaiting(projectId: UUID): Promise<FeatureEntity[]> {
    const rows = await this.db.queryAll<FeatureRow>(
      `SELECT * FROM features
       WHERE project_id = $1
         AND status IN ('draft', 'blocked')
       ORDER BY created_at DESC`,
      [projectId]
    );
    return rows.map(this.rowToEntity);
  }

  /**
   * Update feature status
   */
  async updateStatus(
    id: UUID,
    status: FeatureStatus,
    audit?: AuditContext
  ): Promise<FeatureEntity | null> {
    if (audit) {
      return this.updateWithAudit(id, { status }, audit);
    }
    return this.update(id, { status });
  }

  /**
   * Update readiness score
   */
  async updateReadinessScore(
    id: UUID,
    readinessScore: number,
    audit?: AuditContext
  ): Promise<FeatureEntity | null> {
    const updateData: Partial<FeatureEntity> = { readinessScore };

    // Automatically update status based on readiness
    if (readinessScore >= READINESS_THRESHOLD_LOOP_A) {
      updateData.status = 'ready';
    } else if (readinessScore < READINESS_THRESHOLD_NEEDS_ATTENTION) {
      updateData.status = 'needs_clarification';
    }

    if (audit) {
      return this.updateWithAudit(id, updateData, audit);
    }
    return this.update(id, updateData);
  }

  /**
   * Update priority score
   */
  async updatePriorityScore(
    id: UUID,
    priorityScore: number,
    audit?: AuditContext
  ): Promise<FeatureEntity | null> {
    if (audit) {
      return this.updateWithAudit(id, { priorityScore }, audit);
    }
    return this.update(id, { priorityScore });
  }

  /**
   * Calculate and update priority score based on factors
   */
  async calculatePriorityScore(id: UUID): Promise<number> {
    const feature = await this.findById(id);
    if (!feature) {
      throw new Error(`Feature ${id} not found`);
    }

    // Get dependency count
    const depCount = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM feature_dependencies WHERE feature_id = $1`,
      [id]
    );
    const hasDependencies = parseInt(depCount?.count || '0', 10) > 0;

    // Calculate weighted score
    const businessValue = feature.businessValue || 0;
    const urgency = feature.urgencyScore || 0;
    const readiness = feature.readinessScore || 0;
    const complexity = feature.complexityScore || 0;

    const score = Math.max(
      0,
      Math.min(
        100,
        businessValue * 35 +
          urgency * 25 +
          readiness * 20 -
          complexity * 15 -
          (hasDependencies ? 5 : 0)
      )
    );

    await this.update(id, { priorityScore: score });
    return score;
  }

  /**
   * Get feature with full details (readiness, dependencies, etc.)
   */
  async findByIdWithDetails(id: UUID): Promise<FeatureWithDetails | null> {
    const feature = await this.findById(id);
    if (!feature) {
      return null;
    }

    // Get readiness
    const readinessRow = await this.db.queryOne<QueryResultRow>(
      `SELECT * FROM feature_readiness WHERE feature_id = $1`,
      [id]
    );

    const readiness: FeatureReadiness = readinessRow
      ? {
          featureId: id,
          overall: feature.readinessScore,
          businessClarity: parseFloat(readinessRow.business_clarity as string) || 0,
          technicalClarity: parseFloat(readinessRow.technical_clarity as string) || 0,
          testability: parseFloat(readinessRow.testability as string) || 0,
          blockingQuestions: (readinessRow.blocking_questions as ClarificationQuestion[]) || [],
          lastUpdated: readinessRow.last_updated as Date,
        }
      : {
          featureId: id,
          overall: feature.readinessScore,
          businessClarity: 0,
          technicalClarity: 0,
          testability: 0,
          blockingQuestions: [],
          lastUpdated: new Date(),
        };

    // Get dependencies
    const depsRows = await this.db.queryAll<QueryResultRow>(
      `SELECT * FROM feature_dependencies WHERE feature_id = $1`,
      [id]
    );
    const dependencies: FeatureDependency[] = depsRows.map((row) => ({
      featureId: row.feature_id as string,
      dependsOnFeatureId: row.depends_on_feature_id as string,
      dependencyType: row.dependency_type as DependencyType,
    }));

    // Get dependents
    const dependentsRows = await this.db.queryAll<QueryResultRow>(
      `SELECT * FROM feature_dependencies WHERE depends_on_feature_id = $1`,
      [id]
    );
    const dependents: FeatureDependency[] = dependentsRows.map((row) => ({
      featureId: row.feature_id as string,
      dependsOnFeatureId: row.depends_on_feature_id as string,
      dependencyType: row.dependency_type as DependencyType,
    }));

    // Get atomic requirements
    const atomicReqsRows = await this.db.queryAll<QueryResultRow>(
      `SELECT * FROM atomic_requirements WHERE feature_id = $1 ORDER BY sequence_order`,
      [id]
    );
    const atomicRequirements = atomicReqsRows.map((row) => ({
      id: row.id as string,
      featureId: row.feature_id as string,
      text: row.text as string,
      clarityScore: parseFloat(row.clarity_score as string) || 0,
      theme: row.theme as string | undefined,
      dependencies: (row.dependencies as string[]) || [],
      order: row.sequence_order as number,
    }));

    // Get clarification questions
    const questionsRows = await this.db.queryAll<QueryResultRow>(
      `SELECT * FROM clarification_questions WHERE feature_id = $1`,
      [id]
    );
    const clarificationQuestions = questionsRows.map((row) => ({
      id: row.id as string,
      featureId: row.feature_id as string,
      question: row.question as string,
      questionType: row.question_type as 'multiple_choice' | 'yes_no' | 'text' | 'dropdown',
      options: (row.options as string[]) || undefined,
      answer: row.answer as string | undefined,
      answeredAt: row.answered_at as Date | undefined,
      answeredBy: row.answered_by as string | undefined,
      priority: row.priority as 'blocking' | 'important' | 'nice_to_have',
    }));

    return {
      ...feature,
      readiness,
      atomicRequirements,
      clarificationQuestions,
      dependencies,
      dependents,
    };
  }

  /**
   * Add a dependency between features
   */
  async addDependency(
    featureId: UUID,
    dependsOnFeatureId: UUID,
    dependencyType: DependencyType
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO feature_dependencies (feature_id, depends_on_feature_id, dependency_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (feature_id, depends_on_feature_id) DO NOTHING`,
      [featureId, dependsOnFeatureId, dependencyType]
    );
  }

  /**
   * Remove a dependency between features
   */
  async removeDependency(featureId: UUID, dependsOnFeatureId: UUID): Promise<void> {
    await this.db.query(
      `DELETE FROM feature_dependencies WHERE feature_id = $1 AND depends_on_feature_id = $2`,
      [featureId, dependsOnFeatureId]
    );
  }

  /**
   * Update feature readiness details
   */
  async updateReadiness(
    featureId: UUID,
    readiness: Partial<FeatureReadiness>
  ): Promise<void> {
    const existing = await this.db.queryOne<QueryResultRow>(
      `SELECT * FROM feature_readiness WHERE feature_id = $1`,
      [featureId]
    );

    if (existing) {
      // Update existing
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (readiness.businessClarity !== undefined) {
        updates.push(`business_clarity = $${paramIndex++}`);
        values.push(readiness.businessClarity);
      }
      if (readiness.technicalClarity !== undefined) {
        updates.push(`technical_clarity = $${paramIndex++}`);
        values.push(readiness.technicalClarity);
      }
      if (readiness.testability !== undefined) {
        updates.push(`testability = $${paramIndex++}`);
        values.push(readiness.testability);
      }
      if (readiness.blockingQuestions !== undefined) {
        updates.push(`blocking_questions = $${paramIndex++}`);
        values.push(JSON.stringify(readiness.blockingQuestions));
      }

      updates.push(`last_updated = NOW()`);
      values.push(featureId);

      await this.db.query(
        `UPDATE feature_readiness SET ${updates.join(', ')} WHERE feature_id = $${paramIndex}`,
        values
      );
    } else {
      // Insert new
      await this.db.query(
        `INSERT INTO feature_readiness (feature_id, business_clarity, technical_clarity, testability, blocking_questions)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          featureId,
          readiness.businessClarity || 0,
          readiness.technicalClarity || 0,
          readiness.testability || 0,
          JSON.stringify(readiness.blockingQuestions || []),
        ]
      );
    }

    // Calculate and update overall readiness score
    const overall =
      ((readiness.businessClarity || 0) +
        (readiness.technicalClarity || 0) +
        (readiness.testability || 0)) /
      3;
    await this.updateReadinessScore(featureId, overall);
  }

  /**
   * Count features by status for a project
   */
  async countByStatusForProject(projectId: UUID): Promise<Record<FeatureStatus, number>> {
    const rows = await this.db.queryAll<{ status: string; count: string }>(
      `SELECT status, COUNT(*) as count FROM features WHERE project_id = $1 GROUP BY status`,
      [projectId]
    );

    const result: Record<string, number> = {
      draft: 0,
      needs_clarification: 0,
      ready: 0,
      in_progress: 0,
      completed: 0,
      blocked: 0,
      cancelled: 0,
    };

    for (const row of rows) {
      result[row.status] = parseInt(row.count, 10);
    }

    return result as Record<FeatureStatus, number>;
  }
}
