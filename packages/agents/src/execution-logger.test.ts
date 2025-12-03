// ExecutionLogger tests

import { AgentType } from '@entropy/shared';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NoOpExecutionLogger,
  InMemoryExecutionLogger,
  createDatabaseExecutionLogger,
  getExecutionLogger,
  setExecutionLogger,
  type ExecutionLogInput,
} from './execution-logger.js';

const createMockExecutionLog = (): ExecutionLogInput => ({
  input: {
    type: AgentType.CLASSIFIER,
    data: { requirement: 'Test requirement' },
  },
  output: {
    type: AgentType.CLASSIFIER,
    data: { type: 'new_feature', confidence: 0.9 },
    quality: { overall: 0.85, completeness: 0.9, consistency: 0.8, confidence: 0.85 },
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    model: 'claude-sonnet-4-5-20250929',
    latencyMs: 500,
  },
  context: {
    executionId: 'exec-123',
    agentId: 'classifier-agent',
    agentType: AgentType.CLASSIFIER,
    projectId: 'project-456',
    featureId: 'feature-789',
    metadata: {},
    startedAt: new Date(),
  },
});

describe('NoOpExecutionLogger', () => {
  it('should not throw when logging', async () => {
    const logger = new NoOpExecutionLogger();
    const execution = createMockExecutionLog();

    await expect(logger.log(execution)).resolves.toBeUndefined();
  });
});

describe('InMemoryExecutionLogger', () => {
  let logger: InMemoryExecutionLogger;

  beforeEach(() => {
    logger = new InMemoryExecutionLogger();
  });

  describe('log()', () => {
    it('should store execution', async () => {
      const execution = createMockExecutionLog();

      await logger.log(execution);

      expect(logger.count).toBe(1);
    });

    it('should store multiple executions', async () => {
      await logger.log(createMockExecutionLog());
      await logger.log(createMockExecutionLog());
      await logger.log(createMockExecutionLog());

      expect(logger.count).toBe(3);
    });
  });

  describe('getExecutions()', () => {
    it('should return all executions', async () => {
      const exec1 = createMockExecutionLog();
      const exec2 = createMockExecutionLog();

      await logger.log(exec1);
      await logger.log(exec2);

      const executions = logger.getExecutions();

      expect(executions).toHaveLength(2);
    });

    it('should return a copy of the array', async () => {
      await logger.log(createMockExecutionLog());

      const executions1 = logger.getExecutions();
      const executions2 = logger.getExecutions();

      expect(executions1).not.toBe(executions2);
      expect(executions1).toEqual(executions2);
    });
  });

  describe('getExecutionsByAgentType()', () => {
    it('should filter by agent type', async () => {
      const classifierExec = createMockExecutionLog();

      const decomposerExec: ExecutionLogInput = {
        ...createMockExecutionLog(),
        context: {
          ...createMockExecutionLog().context,
          agentType: AgentType.DECOMPOSER,
        },
      };

      await logger.log(classifierExec);
      await logger.log(decomposerExec);

      const classifierExecutions = logger.getExecutionsByAgentType(AgentType.CLASSIFIER);
      const decomposerExecutions = logger.getExecutionsByAgentType(AgentType.DECOMPOSER);

      expect(classifierExecutions).toHaveLength(1);
      expect(decomposerExecutions).toHaveLength(1);
    });

    it('should return empty array for unknown agent type', () => {
      const executions = logger.getExecutionsByAgentType('unknown');

      expect(executions).toEqual([]);
    });
  });

  describe('clear()', () => {
    it('should remove all executions', async () => {
      await logger.log(createMockExecutionLog());
      await logger.log(createMockExecutionLog());

      logger.clear();

      expect(logger.count).toBe(0);
    });
  });

  describe('count', () => {
    it('should return current execution count', async () => {
      expect(logger.count).toBe(0);

      await logger.log(createMockExecutionLog());
      expect(logger.count).toBe(1);

      await logger.log(createMockExecutionLog());
      expect(logger.count).toBe(2);
    });
  });
});

describe('createDatabaseExecutionLogger()', () => {
  it('should create logger that persists to repository', async () => {
    const startExecution = vi.fn().mockResolvedValue({ id: 'exec-db-123' });
    const completeExecution = vi.fn().mockResolvedValue({});

    const logger = createDatabaseExecutionLogger(
      { agentConfigId: 'config-123' },
      { startExecution, completeExecution }
    );

    const execution = createMockExecutionLog();
    await logger.log(execution);

    expect(startExecution).toHaveBeenCalledTimes(1);
    expect(startExecution).toHaveBeenCalledWith({
      agentConfigId: 'config-123',
      projectId: 'project-456',
      featureId: 'feature-789',
      requirementId: undefined,
      modelUsed: 'claude-sonnet-4-5-20250929',
      requestMetadata: {
        inputType: AgentType.CLASSIFIER,
        inputData: { requirement: 'Test requirement' },
      },
    });

    expect(completeExecution).toHaveBeenCalledTimes(1);
    expect(completeExecution).toHaveBeenCalledWith('exec-db-123', {
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0,
      latencyMs: 500,
      qualityScore: 0.85,
      responseMetadata: {
        outputData: { type: 'new_feature', confidence: 0.9 },
        quality: { overall: 0.85, completeness: 0.9, consistency: 0.8, confidence: 0.85 },
      },
    });
  });

  it('should not throw when repository fails', async () => {
    const startExecution = vi.fn().mockRejectedValue(new Error('DB error'));
    const completeExecution = vi.fn();

    const logger = createDatabaseExecutionLogger(
      { agentConfigId: 'config-123' },
      { startExecution, completeExecution }
    );

    const execution = createMockExecutionLog();

    // Should not throw
    await expect(logger.log(execution)).resolves.toBeUndefined();
  });

  it('should include requirement ID when present', async () => {
    const startExecution = vi.fn().mockResolvedValue({ id: 'exec-db-123' });
    const completeExecution = vi.fn().mockResolvedValue({});

    const logger = createDatabaseExecutionLogger(
      { agentConfigId: 'config-123' },
      { startExecution, completeExecution }
    );

    const execution = createMockExecutionLog();
    execution.context.requirementId = 'req-999';

    await logger.log(execution);

    expect(startExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        requirementId: 'req-999',
      })
    );
  });
});

describe('Global execution logger', () => {
  const originalLogger = getExecutionLogger();

  afterEach(() => {
    setExecutionLogger(originalLogger);
  });

  describe('getExecutionLogger()', () => {
    it('should return default NoOp logger', () => {
      // Reset to default by setting NoOp
      setExecutionLogger(new NoOpExecutionLogger());
      const logger = getExecutionLogger();

      expect(logger).toBeInstanceOf(NoOpExecutionLogger);
    });
  });

  describe('setExecutionLogger()', () => {
    it('should set custom logger', () => {
      const customLogger = new InMemoryExecutionLogger();

      setExecutionLogger(customLogger);
      const logger = getExecutionLogger();

      expect(logger).toBe(customLogger);
    });
  });
});
