// Execution logger for persisting agent executions

import type { AgentInput, AgentOutput, ExecutionContext } from '@entropy/shared';
import { createLogger } from '@entropy/shared';

const logger = createLogger('execution-logger');

/**
 * Input for logging an execution
 */
export interface ExecutionLogInput {
  input: AgentInput;
  output: AgentOutput;
  context: ExecutionContext;
}

/**
 * Interface for execution logging
 */
export interface ExecutionLogger {
  /**
   * Log an agent execution
   */
  log(execution: ExecutionLogInput): Promise<void>;
}

/**
 * No-op execution logger (default when no persistence is configured)
 */
export class NoOpExecutionLogger implements ExecutionLogger {
  async log(_execution: ExecutionLogInput): Promise<void> {
    // No-op: just logs to console via the agent's logger
  }
}

/**
 * In-memory execution logger for testing
 */
export class InMemoryExecutionLogger implements ExecutionLogger {
  private executions: ExecutionLogInput[] = [];

  async log(execution: ExecutionLogInput): Promise<void> {
    this.executions.push(execution);
    logger.debug('Execution logged to memory', {
      executionId: execution.context.executionId,
      agentType: execution.context.agentType,
    });
  }

  /**
   * Get all logged executions
   */
  getExecutions(): ExecutionLogInput[] {
    return [...this.executions];
  }

  /**
   * Get executions by agent type
   */
  getExecutionsByAgentType(agentType: string): ExecutionLogInput[] {
    return this.executions.filter((e) => e.context.agentType === agentType);
  }

  /**
   * Clear all logged executions
   */
  clear(): void {
    this.executions = [];
  }

  /**
   * Get execution count
   */
  get count(): number {
    return this.executions.length;
  }
}

/**
 * Database execution logger for production use
 * Note: This is a factory that creates a logger from an ExecutionRepository
 */
export interface DatabaseExecutionLoggerConfig {
  /**
   * Agent configuration ID (required for database schema)
   */
  agentConfigId: string;
}

/**
 * Creates a database execution logger from repository functions
 * This allows decoupling from the actual repository implementation
 */
export function createDatabaseExecutionLogger(
  config: DatabaseExecutionLoggerConfig,
  repository: {
    startExecution: (input: {
      agentConfigId: string;
      projectId?: string;
      featureId?: string;
      requirementId?: string;
      modelUsed: string;
      requestMetadata?: Record<string, unknown>;
    }) => Promise<{ id: string }>;
    completeExecution: (
      id: string,
      input: {
        inputTokens: number;
        outputTokens: number;
        costUsd: number;
        latencyMs: number;
        qualityScore?: number;
        responseMetadata?: Record<string, unknown>;
      }
    ) => Promise<unknown>;
  }
): ExecutionLogger {
  return {
    async log(execution: ExecutionLogInput): Promise<void> {
      const { input, output, context } = execution;

      try {
        // Start the execution record
        const record = await repository.startExecution({
          agentConfigId: config.agentConfigId,
          projectId: context.projectId,
          featureId: context.featureId,
          requirementId: context.requirementId,
          modelUsed: output.model,
          requestMetadata: {
            inputType: input.type,
            inputData: input.data,
          },
        });

        // Complete the execution with results
        await repository.completeExecution(record.id, {
          inputTokens: output.usage.inputTokens,
          outputTokens: output.usage.outputTokens,
          costUsd: 0, // TODO: Calculate from model adapter
          latencyMs: output.latencyMs,
          qualityScore: output.quality.overall,
          responseMetadata: {
            outputData: output.data,
            quality: output.quality,
          },
        });

        logger.info('Execution persisted to database', {
          executionId: record.id,
          agentType: context.agentType,
          model: output.model,
        });
      } catch (error) {
        // Log error but don't throw - execution logging should not fail the agent
        logger.error('Failed to persist execution', {
          executionId: context.executionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}

// Global execution logger singleton
let globalExecutionLogger: ExecutionLogger = new NoOpExecutionLogger();

/**
 * Get the global execution logger
 */
export function getExecutionLogger(): ExecutionLogger {
  return globalExecutionLogger;
}

/**
 * Set the global execution logger
 */
export function setExecutionLogger(logger: ExecutionLogger): void {
  globalExecutionLogger = logger;
}
