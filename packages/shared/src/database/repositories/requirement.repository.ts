// Repository for Requirement entity

import { QueryResultRow } from 'pg';
import { DatabaseClient } from '../client.js';
import {
  BaseRepository,
  AuditContext,
  rowToEntityBase,
  entityToRowBase,
} from '../base-repository.js';
import type {
  Requirement,
  CreateRequirementInput,
  RequirementStatus,
  RequirementType,
} from '../../types/requirement.js';
import type { UUID, PaginatedResult, PaginationParams } from '../../types/common.js';

/**
 * Database row type for requirements
 */
interface RequirementRow extends QueryResultRow {
  id: string;
  project_id: string;
  title: string;
  source_type: string | null;
  source_file_s3_key: string | null;
  extracted_text_s3_key: string | null;
  raw_metadata: Record<string, unknown> | null;
  type: string | null;
  type_confidence: string | null;
  status: string;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}

/**
 * Extended requirement interface with database fields
 */
export interface RequirementEntity extends Requirement {
  rawMetadata?: Record<string, unknown>;
  createdBy?: UUID;
}

/**
 * Repository for managing Requirement entities
 */
export class RequirementRepository extends BaseRepository<RequirementEntity> {
  protected rowToEntity = (row: QueryResultRow): RequirementEntity => {
    const typedRow = row as RequirementRow;
    const base = rowToEntityBase(row) as unknown as RequirementEntity;
    return {
      ...base,
      status: typedRow.status as RequirementStatus,
      type: typedRow.type as RequirementType | undefined,
      typeConfidence: typedRow.type_confidence ? parseFloat(typedRow.type_confidence) : undefined,
    };
  };

  protected entityToRow = (entity: Partial<RequirementEntity>): Record<string, unknown> => {
    const row = entityToRowBase(entity as Record<string, unknown>);
    // Handle JSON fields
    if (entity.rawMetadata !== undefined) {
      row.raw_metadata = JSON.stringify(entity.rawMetadata);
    }
    return row;
  };

  constructor(db: DatabaseClient) {
    super(db, 'requirements');
  }

  /**
   * Create a new requirement
   */
  async createRequirement(
    input: CreateRequirementInput,
    createdBy: UUID,
    audit?: AuditContext
  ): Promise<RequirementEntity> {
    const data = {
      projectId: input.projectId,
      title: input.title,
      sourceFileS3Key: input.sourceFileS3Key,
      sourceType: 'document' as const,
      status: 'uploaded' as RequirementStatus,
      createdBy,
    };

    if (audit) {
      return this.createWithAudit(data as Omit<RequirementEntity, 'id' | 'createdAt' | 'updatedAt'>, audit);
    }
    return this.create(data as Omit<RequirementEntity, 'id' | 'createdAt' | 'updatedAt'>);
  }

  /**
   * Find requirements by project ID
   */
  async findByProjectId(
    projectId: UUID,
    pagination?: PaginationParams
  ): Promise<RequirementEntity[]> {
    let query = `
      SELECT * FROM requirements
      WHERE project_id = $1
      ORDER BY created_at DESC
    `;

    const params: unknown[] = [projectId];

    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query += ` LIMIT $2 OFFSET $3`;
      params.push(pagination.limit, offset);
    }

    const rows = await this.db.queryAll<RequirementRow>(query, params);
    return rows.map(this.rowToEntity);
  }

  /**
   * Find requirements by project ID with pagination
   */
  async findByProjectIdPaginated(
    projectId: UUID,
    pagination: PaginationParams
  ): Promise<PaginatedResult<RequirementEntity>> {
    const offset = (pagination.page - 1) * pagination.limit;

    const [rows, countResult] = await Promise.all([
      this.db.queryAll<RequirementRow>(
        `SELECT * FROM requirements WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [projectId, pagination.limit, offset]
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM requirements WHERE project_id = $1`,
        [projectId]
      ),
    ]);

    const total = parseInt(countResult?.count || '0', 10);

    return {
      data: rows.map(this.rowToEntity),
      total,
      page: pagination.page,
      limit: pagination.limit,
      hasMore: offset + rows.length < total,
    };
  }

  /**
   * Find requirements by status
   */
  async findByStatus(status: RequirementStatus): Promise<RequirementEntity[]> {
    const rows = await this.db.queryAll<RequirementRow>(
      `SELECT * FROM requirements WHERE status = $1 ORDER BY created_at DESC`,
      [status]
    );
    return rows.map(this.rowToEntity);
  }

  /**
   * Update requirement status
   */
  async updateStatus(
    id: UUID,
    status: RequirementStatus,
    audit?: AuditContext,
    errorMessage?: string
  ): Promise<RequirementEntity | null> {
    const updateData: Partial<RequirementEntity> = { status };
    if (errorMessage !== undefined) {
      updateData.errorMessage = errorMessage;
    }

    if (audit) {
      return this.updateWithAudit(id, updateData, audit);
    }
    return this.update(id, updateData);
  }

  /**
   * Update requirement type after classification
   */
  async updateClassification(
    id: UUID,
    type: RequirementType,
    confidence: number,
    audit?: AuditContext
  ): Promise<RequirementEntity | null> {
    const updateData = {
      type,
      typeConfidence: confidence,
      status: 'classified' as RequirementStatus,
    };

    if (audit) {
      return this.updateWithAudit(id, updateData, audit);
    }
    return this.update(id, updateData);
  }

  /**
   * Update extracted text S3 key
   */
  async updateExtractedText(
    id: UUID,
    extractedTextS3Key: string,
    audit?: AuditContext
  ): Promise<RequirementEntity | null> {
    const updateData = {
      extractedTextS3Key,
      status: 'extracted' as RequirementStatus,
    };

    if (audit) {
      return this.updateWithAudit(id, updateData, audit);
    }
    return this.update(id, updateData);
  }

  /**
   * Mark requirement as decomposed
   */
  async markDecomposed(
    id: UUID,
    audit?: AuditContext
  ): Promise<RequirementEntity | null> {
    if (audit) {
      return this.updateWithAudit(id, { status: 'decomposed' as RequirementStatus }, audit);
    }
    return this.update(id, { status: 'decomposed' as RequirementStatus });
  }

  /**
   * Mark requirement as failed
   */
  async markFailed(
    id: UUID,
    errorMessage: string,
    audit?: AuditContext
  ): Promise<RequirementEntity | null> {
    const updateData = {
      status: 'failed' as RequirementStatus,
      errorMessage,
    };

    if (audit) {
      return this.updateWithAudit(id, updateData, audit);
    }
    return this.update(id, updateData);
  }

  /**
   * Find requirements pending processing (extracting, classifying, decomposing)
   */
  async findPendingProcessing(): Promise<RequirementEntity[]> {
    const rows = await this.db.queryAll<RequirementRow>(
      `SELECT * FROM requirements
       WHERE status IN ('uploaded', 'extracting', 'extracted', 'classifying', 'classified', 'decomposing')
       ORDER BY created_at ASC`
    );
    return rows.map(this.rowToEntity);
  }

  /**
   * Count requirements by status for a project
   */
  async countByStatusForProject(
    projectId: UUID
  ): Promise<Record<RequirementStatus, number>> {
    const rows = await this.db.queryAll<{ status: string; count: string }>(
      `SELECT status, COUNT(*) as count
       FROM requirements
       WHERE project_id = $1
       GROUP BY status`,
      [projectId]
    );

    const result: Record<string, number> = {
      uploaded: 0,
      extracting: 0,
      extracted: 0,
      classifying: 0,
      classified: 0,
      decomposing: 0,
      decomposed: 0,
      failed: 0,
    };

    for (const row of rows) {
      result[row.status] = parseInt(row.count, 10);
    }

    return result as Record<RequirementStatus, number>;
  }
}
