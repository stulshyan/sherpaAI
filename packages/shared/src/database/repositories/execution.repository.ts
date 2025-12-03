// Repository for Agent Execution entity

import { QueryResultRow } from 'pg';
import { DatabaseClient } from '../client.js';
import type { UUID, PaginationParams } from '../../types/common.js';

/**
 * Execution status type
 */
export type ExecutionStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Agent execution entity
 */
export interface ExecutionEntity {
  id: UUID;
  agentConfigId: UUID;
  projectId?: UUID;
  featureId?: UUID;
  requirementId?: UUID;
  modelUsed: string;
  modelId?: UUID;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  status: ExecutionStatus;
  errorMessage?: string;
  errorCode?: string;
  isFallback: boolean;
  fallbackDepth: number;
  qualityScore?: number;
  requestMetadata?: Record<string, unknown>;
  responseMetadata?: Record<string, unknown>;
  createdAt: Date;
  completedAt?: Date;
}

/**
 * Database row type for executions
 */
interface ExecutionRow extends QueryResultRow {
  id: string;
  agent_config_id: string;
  project_id: string | null;
  feature_id: string | null;
  requirement_id: string | null;
  model_used: string;
  model_id: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: string;
  latency_ms: number;
  status: string;
  error_message: string | null;
  error_code: string | null;
  is_fallback: boolean;
  fallback_depth: number;
  quality_score: string | null;
  request_metadata: Record<string, unknown> | null;
  response_metadata: Record<string, unknown> | null;
  created_at: Date;
  completed_at: Date | null;
}

/**
 * Input for creating a new execution
 */
export interface CreateExecutionInput {
  agentConfigId: UUID;
  projectId?: UUID;
  featureId?: UUID;
  requirementId?: UUID;
  modelUsed: string;
  modelId?: UUID;
  requestMetadata?: Record<string, unknown>;
}

/**
 * Input for completing an execution
 */
export interface CompleteExecutionInput {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  qualityScore?: number;
  responseMetadata?: Record<string, unknown>;
  isFallback?: boolean;
  fallbackDepth?: number;
}

/**
 * Input for failing an execution
 */
export interface FailExecutionInput {
  errorMessage: string;
  errorCode?: string;
  latencyMs?: number;
  isFallback?: boolean;
  fallbackDepth?: number;
}

/**
 * Execution statistics
 */
export interface ExecutionStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  fallbackUsed: number;
  avgLatencyMs: number;
  avgCostUsd: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgQualityScore: number | null;
}

/**
 * Repository for managing Agent Execution entities
 * Note: Does not extend BaseRepository as executions don't have updatedAt
 */
export class ExecutionRepository {
  protected db: DatabaseClient;
  protected tableName = 'agent_executions';

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  private rowToEntity(row: ExecutionRow): ExecutionEntity {
    return {
      id: row.id,
      agentConfigId: row.agent_config_id,
      projectId: row.project_id ?? undefined,
      featureId: row.feature_id ?? undefined,
      requirementId: row.requirement_id ?? undefined,
      modelUsed: row.model_used,
      modelId: row.model_id ?? undefined,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      costUsd: parseFloat(row.cost_usd) || 0,
      latencyMs: row.latency_ms,
      status: row.status as ExecutionStatus,
      errorMessage: row.error_message ?? undefined,
      errorCode: row.error_code ?? undefined,
      isFallback: row.is_fallback,
      fallbackDepth: row.fallback_depth,
      qualityScore: row.quality_score ? parseFloat(row.quality_score) : undefined,
      requestMetadata: row.request_metadata ?? undefined,
      responseMetadata: row.response_metadata ?? undefined,
      createdAt: row.created_at,
      completedAt: row.completed_at ?? undefined,
    };
  }


  /**
   * Find execution by ID
   */
  async findById(id: UUID): Promise<ExecutionEntity | null> {
    const row = await this.db.queryOne<ExecutionRow>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return row ? this.rowToEntity(row) : null;
  }

  /**
   * Start a new execution (creates with pending status)
   */
  async startExecution(input: CreateExecutionInput): Promise<ExecutionEntity> {
    const row = await this.db.queryOne<ExecutionRow>(
      `INSERT INTO ${this.tableName}
       (agent_config_id, project_id, feature_id, requirement_id, model_used, model_id,
        request_metadata, input_tokens, output_tokens, cost_usd, latency_ms, status, is_fallback, fallback_depth)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, 0, 0, 'pending', false, 0)
       RETURNING *`,
      [
        input.agentConfigId,
        input.projectId ?? null,
        input.featureId ?? null,
        input.requirementId ?? null,
        input.modelUsed,
        input.modelId ?? null,
        input.requestMetadata ? JSON.stringify(input.requestMetadata) : null,
      ]
    );
    return this.rowToEntity(row!);
  }

  /**
   * Mark execution as processing
   */
  async markProcessing(id: UUID): Promise<ExecutionEntity | null> {
    const row = await this.db.queryOne<ExecutionRow>(
      `UPDATE ${this.tableName} SET status = 'processing' WHERE id = $1 RETURNING *`,
      [id]
    );
    return row ? this.rowToEntity(row) : null;
  }

  /**
   * Complete an execution with results
   */
  async completeExecution(
    id: UUID,
    input: CompleteExecutionInput
  ): Promise<ExecutionEntity | null> {
    const row = await this.db.queryOne<ExecutionRow>(
      `UPDATE ${this.tableName}
       SET status = 'completed', input_tokens = $2, output_tokens = $3, cost_usd = $4,
           latency_ms = $5, quality_score = $6, response_metadata = $7,
           is_fallback = $8, fallback_depth = $9, completed_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id,
        input.inputTokens,
        input.outputTokens,
        input.costUsd,
        input.latencyMs,
        input.qualityScore ?? null,
        input.responseMetadata ? JSON.stringify(input.responseMetadata) : null,
        input.isFallback ?? false,
        input.fallbackDepth ?? 0,
      ]
    );
    return row ? this.rowToEntity(row) : null;
  }

  /**
   * Fail an execution with error
   */
  async failExecution(id: UUID, input: FailExecutionInput): Promise<ExecutionEntity | null> {
    const row = await this.db.queryOne<ExecutionRow>(
      `UPDATE ${this.tableName}
       SET status = 'failed', error_message = $2, error_code = $3, latency_ms = $4,
           is_fallback = $5, fallback_depth = $6, completed_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id,
        input.errorMessage,
        input.errorCode ?? null,
        input.latencyMs ?? 0,
        input.isFallback ?? false,
        input.fallbackDepth ?? 0,
      ]
    );
    return row ? this.rowToEntity(row) : null;
  }

  /**
   * Find executions by feature ID
   */
  async findByFeatureId(
    featureId: UUID,
    pagination?: PaginationParams
  ): Promise<ExecutionEntity[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE feature_id = $1 ORDER BY created_at DESC`;
    const params: unknown[] = [featureId];

    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query += ` LIMIT $2 OFFSET $3`;
      params.push(pagination.limit, offset);
    }

    const rows = await this.db.queryAll<ExecutionRow>(query, params);
    return rows.map((row) => this.rowToEntity(row));
  }

  /**
   * Find executions by requirement ID
   */
  async findByRequirementId(requirementId: UUID): Promise<ExecutionEntity[]> {
    const rows = await this.db.queryAll<ExecutionRow>(
      `SELECT * FROM ${this.tableName} WHERE requirement_id = $1 ORDER BY created_at DESC`,
      [requirementId]
    );
    return rows.map((row) => this.rowToEntity(row));
  }

  /**
   * Find executions by agent config ID
   */
  async findByAgentConfigId(
    agentConfigId: UUID,
    pagination?: PaginationParams
  ): Promise<ExecutionEntity[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE agent_config_id = $1 ORDER BY created_at DESC`;
    const params: unknown[] = [agentConfigId];

    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query += ` LIMIT $2 OFFSET $3`;
      params.push(pagination.limit, offset);
    }

    const rows = await this.db.queryAll<ExecutionRow>(query, params);
    return rows.map((row) => this.rowToEntity(row));
  }

  /**
   * Find recent failed executions
   */
  async findRecentFailed(limit: number = 10): Promise<ExecutionEntity[]> {
    const rows = await this.db.queryAll<ExecutionRow>(
      `SELECT * FROM ${this.tableName} WHERE status = 'failed' ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return rows.map((row) => this.rowToEntity(row));
  }

  /**
   * Calculate total cost for a feature
   */
  async getTotalCostForFeature(featureId: UUID): Promise<number> {
    const result = await this.db.queryOne<{ total: string }>(
      `SELECT COALESCE(SUM(cost_usd), 0) as total FROM ${this.tableName} WHERE feature_id = $1 AND status = 'completed'`,
      [featureId]
    );
    return parseFloat(result?.total || '0');
  }

  /**
   * Calculate total cost for a requirement
   */
  async getTotalCostForRequirement(requirementId: UUID): Promise<number> {
    const result = await this.db.queryOne<{ total: string }>(
      `SELECT COALESCE(SUM(cost_usd), 0) as total FROM ${this.tableName} WHERE requirement_id = $1 AND status = 'completed'`,
      [requirementId]
    );
    return parseFloat(result?.total || '0');
  }

  /**
   * Get cost breakdown by agent type for a feature
   */
  async getCostBreakdownForFeature(featureId: UUID): Promise<Record<string, number>> {
    const rows = await this.db.queryAll<{ agent_type: string; total: string }>(
      `SELECT ac.agent_type, COALESCE(SUM(ae.cost_usd), 0) as total
       FROM ${this.tableName} ae
       JOIN agent_configurations ac ON ae.agent_config_id = ac.id
       WHERE ae.feature_id = $1 AND ae.status = 'completed'
       GROUP BY ac.agent_type`,
      [featureId]
    );

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.agent_type] = parseFloat(row.total);
    }
    return result;
  }

  /**
   * Get execution statistics for an agent type
   */
  async getStatsForAgentType(agentType: string, days: number = 30): Promise<ExecutionStats> {
    const result = await this.db.queryOne<{
      total: string;
      successful: string;
      failed: string;
      fallback_used: string;
      avg_latency: string;
      avg_cost: string;
      total_cost: string;
      total_input_tokens: string;
      total_output_tokens: string;
      avg_quality: string | null;
    }>(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE ae.status = 'completed') as successful,
         COUNT(*) FILTER (WHERE ae.status = 'failed') as failed,
         COUNT(*) FILTER (WHERE ae.is_fallback = true) as fallback_used,
         ROUND(AVG(ae.latency_ms)::numeric, 2) as avg_latency,
         ROUND(AVG(ae.cost_usd)::numeric, 6) as avg_cost,
         ROUND(SUM(ae.cost_usd)::numeric, 4) as total_cost,
         SUM(ae.input_tokens) as total_input_tokens,
         SUM(ae.output_tokens) as total_output_tokens,
         ROUND(AVG(ae.quality_score)::numeric, 2) as avg_quality
       FROM ${this.tableName} ae
       JOIN agent_configurations ac ON ae.agent_config_id = ac.id
       WHERE ac.agent_type = $1 AND ae.created_at >= NOW() - INTERVAL '${days} days'`,
      [agentType]
    );

    return {
      totalExecutions: parseInt(result?.total || '0', 10),
      successfulExecutions: parseInt(result?.successful || '0', 10),
      failedExecutions: parseInt(result?.failed || '0', 10),
      fallbackUsed: parseInt(result?.fallback_used || '0', 10),
      avgLatencyMs: parseFloat(result?.avg_latency || '0'),
      avgCostUsd: parseFloat(result?.avg_cost || '0'),
      totalCostUsd: parseFloat(result?.total_cost || '0'),
      totalInputTokens: parseInt(result?.total_input_tokens || '0', 10),
      totalOutputTokens: parseInt(result?.total_output_tokens || '0', 10),
      avgQualityScore: result?.avg_quality ? parseFloat(result.avg_quality) : null,
    };
  }

  /**
   * Get daily cost summary for the last N days
   */
  async getDailyCostSummary(days: number = 30): Promise<Array<{ date: string; cost: number; executions: number }>> {
    const rows = await this.db.queryAll<{ date: string; cost: string; executions: string }>(
      `SELECT
         DATE(created_at) as date,
         COALESCE(SUM(cost_usd), 0) as cost,
         COUNT(*) as executions
       FROM ${this.tableName}
       WHERE created_at >= NOW() - INTERVAL '${days} days' AND status = 'completed'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`
    );

    return rows.map((row) => ({
      date: row.date,
      cost: parseFloat(row.cost),
      executions: parseInt(row.executions, 10),
    }));
  }

  /**
   * Get execution count by status
   */
  async countByStatus(): Promise<Record<ExecutionStatus, number>> {
    const rows = await this.db.queryAll<{ status: string; count: string }>(
      `SELECT status, COUNT(*) as count FROM ${this.tableName} GROUP BY status`
    );

    const result: Record<string, number> = { pending: 0, processing: 0, completed: 0, failed: 0 };
    for (const row of rows) {
      result[row.status] = parseInt(row.count, 10);
    }
    return result as Record<ExecutionStatus, number>;
  }

  /**
   * Clean up old completed executions (for data retention)
   */
  async cleanupOldExecutions(retentionDays: number = 90): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE status IN ('completed', 'failed') AND created_at < NOW() - INTERVAL '${retentionDays} days'`
    );
    return result.rowCount ?? 0;
  }
}
