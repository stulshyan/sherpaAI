// Base repository class with common CRUD operations

import { PoolClient, QueryResultRow } from 'pg';
import type { UUID, PaginationParams, PaginatedResult } from '../types/common.js';
import { DatabaseClient, QueryBuilder } from './client.js';

/**
 * Audit context for tracking changes
 */
export interface AuditContext {
  actor: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Base entity interface
 */
export interface BaseEntity {
  id: UUID;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Row to entity converter type
 */
export type RowToEntity<T> = (row: QueryResultRow) => T;

/**
 * Entity to row converter type
 */
export type EntityToRow<T> = (entity: Partial<T>) => Record<string, unknown>;

/**
 * Base repository class providing common CRUD operations
 */
export abstract class BaseRepository<T extends BaseEntity> {
  protected db: DatabaseClient;
  protected tableName: string;
  protected abstract rowToEntity: RowToEntity<T>;
  protected abstract entityToRow: EntityToRow<T>;

  constructor(db: DatabaseClient, tableName: string) {
    this.db = db;
    this.tableName = tableName;
  }

  /**
   * Find entity by ID
   */
  async findById(id: UUID): Promise<T | null> {
    const row = await this.db.queryOne(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return row ? this.rowToEntity(row) : null;
  }

  /**
   * Find entity by ID or throw error
   */
  async findByIdOrThrow(id: UUID): Promise<T> {
    const entity = await this.findById(id);
    if (!entity) {
      throw new Error(`${this.tableName} with ID ${id} not found`);
    }
    return entity;
  }

  /**
   * Check if entity exists by ID
   */
  async existsById(id: UUID): Promise<boolean> {
    const result = await this.db.queryOne<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE id = $1) as exists`,
      [id]
    );
    return result?.exists ?? false;
  }

  /**
   * Find all entities with optional pagination
   */
  async findAll(pagination?: PaginationParams): Promise<T[]> {
    let query = `SELECT * FROM ${this.tableName} ORDER BY created_at DESC`;

    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query += ` LIMIT ${pagination.limit} OFFSET ${offset}`;
    }

    const rows = await this.db.queryAll(query);
    return rows.map(this.rowToEntity);
  }

  /**
   * Find all entities with pagination info
   */
  async findAllPaginated(pagination: PaginationParams): Promise<PaginatedResult<T>> {
    const offset = (pagination.page - 1) * pagination.limit;

    const [rows, countResult] = await Promise.all([
      this.db.queryAll(
        `SELECT * FROM ${this.tableName} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [pagination.limit, offset]
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM ${this.tableName}`
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
   * Create a new entity
   */
  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const rowData = this.entityToRow(data as Partial<T>);
    const { text, values } = QueryBuilder.insert(this.tableName, rowData);
    const row = await this.db.queryOne(text, values);
    return this.rowToEntity(row!);
  }

  /**
   * Create entity with audit trail
   */
  async createWithAudit(
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
    audit: AuditContext
  ): Promise<T> {
    return this.db.withTransaction(async (client) => {
      const rowData = this.entityToRow(data as Partial<T>);
      const { text, values } = QueryBuilder.insert(this.tableName, rowData);
      const result = await client.query(text, values);
      const created = this.rowToEntity(result.rows[0]);

      // Create audit log entry
      await this.createAuditLog(client, {
        entityType: this.tableName,
        entityId: created.id,
        action: 'created',
        actor: audit.actor,
        newState: created,
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
      });

      return created;
    });
  }

  /**
   * Update entity by ID
   */
  async update(id: UUID, data: Partial<T>): Promise<T | null> {
    const rowData = this.entityToRow(data);
    const { text, values } = QueryBuilder.update(this.tableName, rowData, 'id', id);
    const row = await this.db.queryOne(text, values);
    return row ? this.rowToEntity(row) : null;
  }

  /**
   * Update entity with audit trail
   */
  async updateWithAudit(
    id: UUID,
    data: Partial<T>,
    audit: AuditContext
  ): Promise<T | null> {
    return this.db.withTransaction(async (client) => {
      // Get previous state
      const prevResult = await client.query(
        `SELECT * FROM ${this.tableName} WHERE id = $1`,
        [id]
      );
      const previous = prevResult.rows[0] ? this.rowToEntity(prevResult.rows[0]) : null;

      if (!previous) {
        return null;
      }

      // Apply update
      const rowData = this.entityToRow(data);
      const { text, values } = QueryBuilder.update(this.tableName, rowData, 'id', id);
      const result = await client.query(text, values);
      const updated = this.rowToEntity(result.rows[0]);

      // Create audit log entry
      await this.createAuditLog(client, {
        entityType: this.tableName,
        entityId: id,
        action: 'updated',
        actor: audit.actor,
        previousState: previous,
        newState: updated,
        changeDetails: data,
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
      });

      return updated;
    });
  }

  /**
   * Delete entity by ID
   */
  async delete(id: UUID): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Delete entity with audit trail
   */
  async deleteWithAudit(id: UUID, audit: AuditContext): Promise<boolean> {
    return this.db.withTransaction(async (client) => {
      // Get previous state
      const prevResult = await client.query(
        `SELECT * FROM ${this.tableName} WHERE id = $1`,
        [id]
      );
      const previous = prevResult.rows[0] ? this.rowToEntity(prevResult.rows[0]) : null;

      if (!previous) {
        return false;
      }

      // Delete the entity
      const deleteResult = await client.query(
        `DELETE FROM ${this.tableName} WHERE id = $1`,
        [id]
      );

      // Create audit log entry
      await this.createAuditLog(client, {
        entityType: this.tableName,
        entityId: id,
        action: 'deleted',
        actor: audit.actor,
        previousState: previous,
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
      });

      return (deleteResult.rowCount ?? 0) > 0;
    });
  }

  /**
   * Count all entities
   */
  async count(): Promise<number> {
    const result = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${this.tableName}`
    );
    return parseInt(result?.count || '0', 10);
  }

  /**
   * Count entities matching a condition
   */
  async countWhere(whereClause: string, params: unknown[]): Promise<number> {
    const result = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${whereClause}`,
      params
    );
    return parseInt(result?.count || '0', 10);
  }

  /**
   * Find entities matching a condition
   */
  protected async findWhere(
    whereClause: string,
    params: unknown[],
    orderBy: string = 'created_at DESC',
    limit?: number
  ): Promise<T[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE ${whereClause} ORDER BY ${orderBy}`;
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    const rows = await this.db.queryAll(query, params);
    return rows.map(this.rowToEntity);
  }

  /**
   * Find first entity matching a condition
   */
  protected async findOneWhere(
    whereClause: string,
    params: unknown[]
  ): Promise<T | null> {
    const row = await this.db.queryOne(
      `SELECT * FROM ${this.tableName} WHERE ${whereClause}`,
      params
    );
    return row ? this.rowToEntity(row) : null;
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    client: PoolClient,
    log: {
      entityType: string;
      entityId: UUID;
      action: string;
      actor: string;
      previousState?: unknown;
      newState?: unknown;
      changeDetails?: unknown;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    await client.query(
      `INSERT INTO audit_log (entity_type, entity_id, action, actor, previous_state, new_state, change_details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        log.entityType,
        log.entityId,
        log.action,
        log.actor,
        log.previousState ? JSON.stringify(log.previousState) : null,
        log.newState ? JSON.stringify(log.newState) : null,
        log.changeDetails ? JSON.stringify(log.changeDetails) : null,
        log.ipAddress || null,
        log.userAgent || null,
      ]
    );
  }

  /**
   * Execute within a transaction
   */
  async withTransaction<R>(fn: (client: PoolClient) => Promise<R>): Promise<R> {
    return this.db.withTransaction(fn);
  }
}

/**
 * Utility function to convert database row column names (snake_case) to entity property names (camelCase)
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Utility function to convert entity property names (camelCase) to database column names (snake_case)
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert a row object from snake_case to camelCase keys
 */
export function rowToEntityBase(row: QueryResultRow): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[snakeToCamel(key)] = value;
  }
  return result;
}

/**
 * Convert an entity object from camelCase to snake_case keys
 */
export function entityToRowBase(entity: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entity)) {
    if (value !== undefined) {
      result[camelToSnake(key)] = value;
    }
  }
  return result;
}
