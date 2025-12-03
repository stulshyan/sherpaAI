// Repository for Audit Log entity

import { QueryResultRow } from 'pg';
import type { UUID, PaginatedResult, PaginationParams } from '../../types/common.js';
import type { AuditLogEntry } from '../../types/feature.js';
import { rowToEntityBase } from '../base-repository.js';
import { DatabaseClient } from '../client.js';

/**
 * Extended audit log entity
 */
export interface AuditLogEntity extends AuditLogEntry {
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  changeDetails?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Database row type for audit log
 */
interface AuditRow extends QueryResultRow {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string | null;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  change_details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

/**
 * Input for creating an audit log entry
 */
export interface CreateAuditLogInput {
  entityType: string;
  entityId: UUID;
  action: string;
  actor: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  changeDetails?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Filter options for querying audit logs
 */
export interface AuditLogFilter {
  entityType?: string;
  entityId?: UUID;
  actor?: string;
  action?: string;
  fromDate?: Date;
  toDate?: Date;
}

/**
 * Repository for managing Audit Log entries
 * Note: This repository is read-heavy and doesn't extend BaseRepository
 * because audit logs are append-only and never updated
 */
export class AuditRepository {
  private db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  private rowToEntity = (row: AuditRow): AuditLogEntity => {
    const base = rowToEntityBase(row) as unknown as AuditLogEntity;
    return {
      ...base,
      entityType: row.entity_type as AuditLogEntry['entityType'],
    };
  };

  /**
   * Create a new audit log entry
   */
  async create(input: CreateAuditLogInput): Promise<AuditLogEntity> {
    const row = await this.db.queryOne<AuditRow>(
      `INSERT INTO audit_log (entity_type, entity_id, action, actor, previous_state, new_state, change_details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.entityType,
        input.entityId,
        input.action,
        input.actor,
        input.previousState ? JSON.stringify(input.previousState) : null,
        input.newState ? JSON.stringify(input.newState) : null,
        input.changeDetails ? JSON.stringify(input.changeDetails) : null,
        input.ipAddress || null,
        input.userAgent || null,
      ]
    );
    return this.rowToEntity(row!);
  }

  /**
   * Find audit log by ID
   */
  async findById(id: UUID): Promise<AuditLogEntity | null> {
    const row = await this.db.queryOne<AuditRow>(`SELECT * FROM audit_log WHERE id = $1`, [id]);
    return row ? this.rowToEntity(row) : null;
  }

  /**
   * Find audit logs for an entity
   */
  async findByEntityId(
    entityType: string,
    entityId: UUID,
    pagination?: PaginationParams
  ): Promise<AuditLogEntity[]> {
    let query = `
      SELECT * FROM audit_log
      WHERE entity_type = $1 AND entity_id = $2
      ORDER BY created_at DESC
    `;

    const params: unknown[] = [entityType, entityId];

    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query += ` LIMIT $3 OFFSET $4`;
      params.push(pagination.limit, offset);
    }

    const rows = await this.db.queryAll<AuditRow>(query, params);
    return rows.map(this.rowToEntity);
  }

  /**
   * Find audit logs for a specific entity with pagination
   */
  async findByEntityIdPaginated(
    entityType: string,
    entityId: UUID,
    pagination: PaginationParams
  ): Promise<PaginatedResult<AuditLogEntity>> {
    const offset = (pagination.page - 1) * pagination.limit;

    const [rows, countResult] = await Promise.all([
      this.db.queryAll<AuditRow>(
        `SELECT * FROM audit_log WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
        [entityType, entityId, pagination.limit, offset]
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM audit_log WHERE entity_type = $1 AND entity_id = $2`,
        [entityType, entityId]
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
   * Find audit logs by actor
   */
  async findByActor(actor: string, pagination?: PaginationParams): Promise<AuditLogEntity[]> {
    let query = `
      SELECT * FROM audit_log
      WHERE actor = $1
      ORDER BY created_at DESC
    `;

    const params: unknown[] = [actor];

    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query += ` LIMIT $2 OFFSET $3`;
      params.push(pagination.limit, offset);
    }

    const rows = await this.db.queryAll<AuditRow>(query, params);
    return rows.map(this.rowToEntity);
  }

  /**
   * Find audit logs by action type
   */
  async findByAction(action: string, pagination?: PaginationParams): Promise<AuditLogEntity[]> {
    let query = `
      SELECT * FROM audit_log
      WHERE action = $1
      ORDER BY created_at DESC
    `;

    const params: unknown[] = [action];

    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query += ` LIMIT $2 OFFSET $3`;
      params.push(pagination.limit, offset);
    }

    const rows = await this.db.queryAll<AuditRow>(query, params);
    return rows.map(this.rowToEntity);
  }

  /**
   * Find audit logs with filters
   */
  async findWithFilters(
    filters: AuditLogFilter,
    pagination?: PaginationParams
  ): Promise<AuditLogEntity[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.entityType) {
      conditions.push(`entity_type = $${paramIndex++}`);
      params.push(filters.entityType);
    }

    if (filters.entityId) {
      conditions.push(`entity_id = $${paramIndex++}`);
      params.push(filters.entityId);
    }

    if (filters.actor) {
      conditions.push(`actor = $${paramIndex++}`);
      params.push(filters.actor);
    }

    if (filters.action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(filters.action);
    }

    if (filters.fromDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(filters.fromDate);
    }

    if (filters.toDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(filters.toDate);
    }

    let query = `SELECT * FROM audit_log`;
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ` ORDER BY created_at DESC`;

    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
      params.push(pagination.limit, offset);
    }

    const rows = await this.db.queryAll<AuditRow>(query, params);
    return rows.map(this.rowToEntity);
  }

  /**
   * Get recent audit logs
   */
  async getRecent(limit: number = 50): Promise<AuditLogEntity[]> {
    const rows = await this.db.queryAll<AuditRow>(
      `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return rows.map(this.rowToEntity);
  }

  /**
   * Get recent audit logs for a specific entity type
   */
  async getRecentForEntityType(entityType: string, limit: number = 50): Promise<AuditLogEntity[]> {
    const rows = await this.db.queryAll<AuditRow>(
      `SELECT * FROM audit_log WHERE entity_type = $1 ORDER BY created_at DESC LIMIT $2`,
      [entityType, limit]
    );
    return rows.map(this.rowToEntity);
  }

  /**
   * Count audit logs by entity type
   */
  async countByEntityType(): Promise<Record<string, number>> {
    const rows = await this.db.queryAll<{ entity_type: string; count: string }>(
      `SELECT entity_type, COUNT(*) as count FROM audit_log GROUP BY entity_type`
    );

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.entity_type] = parseInt(row.count, 10);
    }
    return result;
  }

  /**
   * Count audit logs by action
   */
  async countByAction(): Promise<Record<string, number>> {
    const rows = await this.db.queryAll<{ action: string; count: string }>(
      `SELECT action, COUNT(*) as count FROM audit_log GROUP BY action`
    );

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.action] = parseInt(row.count, 10);
    }
    return result;
  }

  /**
   * Get audit log summary for a time period
   */
  async getSummary(days: number = 30): Promise<{
    totalEntries: number;
    byEntityType: Record<string, number>;
    byAction: Record<string, number>;
    topActors: Array<{ actor: string; count: number }>;
  }> {
    const [totalResult, entityTypeRows, actionRows, actorRows] = await Promise.all([
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM audit_log WHERE created_at >= NOW() - INTERVAL '${days} days'`
      ),
      this.db.queryAll<{ entity_type: string; count: string }>(
        `SELECT entity_type, COUNT(*) as count
         FROM audit_log
         WHERE created_at >= NOW() - INTERVAL '${days} days'
         GROUP BY entity_type`
      ),
      this.db.queryAll<{ action: string; count: string }>(
        `SELECT action, COUNT(*) as count
         FROM audit_log
         WHERE created_at >= NOW() - INTERVAL '${days} days'
         GROUP BY action`
      ),
      this.db.queryAll<{ actor: string; count: string }>(
        `SELECT actor, COUNT(*) as count
         FROM audit_log
         WHERE created_at >= NOW() - INTERVAL '${days} days' AND actor IS NOT NULL
         GROUP BY actor
         ORDER BY count DESC
         LIMIT 10`
      ),
    ]);

    const byEntityType: Record<string, number> = {};
    for (const row of entityTypeRows) {
      byEntityType[row.entity_type] = parseInt(row.count, 10);
    }

    const byAction: Record<string, number> = {};
    for (const row of actionRows) {
      byAction[row.action] = parseInt(row.count, 10);
    }

    const topActors = actorRows.map((row) => ({
      actor: row.actor,
      count: parseInt(row.count, 10),
    }));

    return {
      totalEntries: parseInt(totalResult?.count || '0', 10),
      byEntityType,
      byAction,
      topActors,
    };
  }

  /**
   * Clean up old audit logs (for data retention)
   */
  async cleanupOldEntries(retentionDays: number = 365): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '${retentionDays} days'`
    );
    return result.rowCount ?? 0;
  }
}
