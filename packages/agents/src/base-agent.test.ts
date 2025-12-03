// BaseAgent tests

import type {
  AgentConfig,
  AgentInput,
  AgentOutput,
  ModelAdapter,
  CompletionResponse,
} from '@entropy/shared';
import { AgentType } from '@entropy/shared';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseAgent } from './base-agent.js';
import { PromptEngine } from './prompt-engine.js';
import { QualityScorer } from './quality.js';
import { OutputValidator } from './validator.js';

// Mock the adapter registry
vi.mock('@entropy/adapters', () => ({
  getAdapterRegistry: vi.fn(() => ({
    get: vi.fn(() => mockAdapter),
  })),
}));

// Mock adapter
const mockAdapter: ModelAdapter = {
  id: 'test-adapter',
  provider: 'anthropic',
  complete: vi.fn(),
  stream: vi.fn(),
  countTokens: vi.fn().mockReturnValue(100),
  estimateCost: vi.fn().mockReturnValue(0.001),
  healthCheck: vi.fn().mockResolvedValue(true),
};

// Concrete implementation for testing
class TestAgent extends BaseAgent {
  buildPromptCalls: AgentInput[] = [];
  parseOutputCalls: string[] = [];

  async buildPrompt(input: AgentInput): Promise<string> {
    this.buildPromptCalls.push(input);
    return `Test prompt for: ${JSON.stringify(input.data)}`;
  }

  async parseOutput(response: string): Promise<Record<string, unknown>> {
    this.parseOutputCalls.push(response);
    // Extract JSON from the response
    const json = this.extractJSON(response);
    return JSON.parse(json);
  }
}

function createTestConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    id: 'test-agent',
    type: AgentType.CLASSIFIER,
    modelId: 'claude-sonnet-4-5-20250929',
    fallbackModelIds: ['gpt-4o'],
    maxRetries: 3,
    timeoutMs: 30000,
    promptTemplateKey: 'test/template',
    temperature: 0.5,
    maxTokens: 1024,
    ...overrides,
  };
}

describe('BaseAgent', () => {
  let agent: TestAgent;
  const defaultConfig = createTestConfig();

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new TestAgent(defaultConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      expect(agent.id).toBe('test-agent');
      expect(agent.type).toBe(AgentType.CLASSIFIER);
      expect(agent.config).toEqual(defaultConfig);
    });

    it('should create prompt engine, validator, and quality scorer', () => {
      expect(agent['promptEngine']).toBeInstanceOf(PromptEngine);
      expect(agent['validator']).toBeInstanceOf(OutputValidator);
      expect(agent['qualityScorer']).toBeInstanceOf(QualityScorer);
    });
  });

  describe('execute()', () => {
    const mockInput: AgentInput = {
      type: AgentType.CLASSIFIER,
      data: { requirement: 'Test requirement' },
    };

    const mockResponse: CompletionResponse = {
      content: '{"type": "new_feature", "confidence": 0.9, "reasoning": "Test"}',
      model: 'claude-sonnet-4-5-20250929',
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      },
      requestId: 'req-123',
      latencyMs: 500,
    };

    beforeEach(() => {
      vi.mocked(mockAdapter.complete).mockResolvedValue(mockResponse);
    });

    it('should execute successfully and return output', async () => {
      const output = await agent.execute(mockInput);

      expect(output.type).toBe(AgentType.CLASSIFIER);
      expect(output.data).toEqual({
        type: 'new_feature',
        confidence: 0.9,
        reasoning: 'Test',
      });
      expect(output.model).toBe('claude-sonnet-4-5-20250929');
      expect(output.latencyMs).toBe(500);
      expect(output.usage).toEqual(mockResponse.usage);
    });

    it('should call buildPrompt with input', async () => {
      await agent.execute(mockInput);

      expect(agent.buildPromptCalls).toHaveLength(1);
      expect(agent.buildPromptCalls[0]).toEqual(mockInput);
    });

    it('should call parseOutput with response content', async () => {
      await agent.execute(mockInput);

      expect(agent.parseOutputCalls).toHaveLength(1);
      expect(agent.parseOutputCalls[0]).toBe(mockResponse.content);
    });

    it('should calculate quality score', async () => {
      const output = await agent.execute(mockInput);

      expect(output.quality).toBeDefined();
      expect(output.quality.overall).toBeGreaterThanOrEqual(0);
      expect(output.quality.overall).toBeLessThanOrEqual(1);
    });

    it('should call lifecycle hooks', async () => {
      const onBeforeExecute = vi.fn();
      const onAfterExecute = vi.fn();

      agent.onBeforeExecute = onBeforeExecute;
      agent.onAfterExecute = onAfterExecute;

      await agent.execute(mockInput);

      expect(onBeforeExecute).toHaveBeenCalledTimes(1);
      expect(onAfterExecute).toHaveBeenCalledTimes(1);
    });

    it('should pass execution context to onBeforeExecute', async () => {
      const onBeforeExecute = vi.fn();
      agent.onBeforeExecute = onBeforeExecute;

      await agent.execute(mockInput);

      const context = onBeforeExecute.mock.calls[0]![0];
      expect(context.executionId).toBeDefined();
      expect(context.agentId).toBe('test-agent');
      expect(context.agentType).toBe(AgentType.CLASSIFIER);
      expect(context.startedAt).toBeInstanceOf(Date);
    });

    it('should pass output to onAfterExecute', async () => {
      const onAfterExecute = vi.fn();
      agent.onAfterExecute = onAfterExecute;

      await agent.execute(mockInput);

      const output: AgentOutput = onAfterExecute.mock.calls[0]![0];
      expect(output.type).toBe(AgentType.CLASSIFIER);
      expect(output.data).toBeDefined();
    });

    it('should call onError on failure', async () => {
      const error = new Error('Test error');
      vi.mocked(mockAdapter.complete).mockRejectedValue(error);

      const onError = vi.fn();
      agent.onError = onError;

      await expect(agent.execute(mockInput)).rejects.toThrow('Test error');
      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should validate output against schema when provided', async () => {
      const configWithSchema = createTestConfig({
        outputSchema: {
          type: 'object',
          required: ['type', 'confidence'],
          properties: {
            type: { type: 'string' },
            confidence: { type: 'number' },
          },
        },
      });

      const agentWithSchema = new TestAgent(configWithSchema);
      const output = await agentWithSchema.execute(mockInput);

      expect(output).toBeDefined();
    });

    it('should throw validation error for invalid output', async () => {
      vi.mocked(mockAdapter.complete).mockResolvedValue({
        ...mockResponse,
        content: '{"invalid": true}',
      });

      const configWithSchema = createTestConfig({
        outputSchema: {
          type: 'object',
          required: ['type', 'confidence'],
          properties: {
            type: { type: 'string' },
            confidence: { type: 'number' },
          },
        },
      });

      const agentWithSchema = new TestAgent(configWithSchema);

      await expect(agentWithSchema.execute(mockInput)).rejects.toThrow('Validation failed');
    });
  });

  describe('extractJSON()', () => {
    it('should extract JSON from markdown code block', () => {
      const content = 'Here is the result:\n```json\n{"key": "value"}\n```\nDone.';
      const result = agent['extractJSON'](content);

      expect(result).toBe('{"key": "value"}');
    });

    it('should extract JSON from code block without language hint', () => {
      const content = '```\n{"key": "value"}\n```';
      const result = agent['extractJSON'](content);

      expect(result).toBe('{"key": "value"}');
    });

    it('should extract raw JSON object', () => {
      const content = 'Result: {"key": "value"}';
      const result = agent['extractJSON'](content);

      expect(result).toBe('{"key": "value"}');
    });

    it('should extract raw JSON array', () => {
      const content = 'Result: [1, 2, 3]';
      const result = agent['extractJSON'](content);

      expect(result).toBe('[1, 2, 3]');
    });

    it('should return trimmed content if no JSON found', () => {
      const content = '  plain text  ';
      const result = agent['extractJSON'](content);

      expect(result).toBe('plain text');
    });
  });

  describe('createContext()', () => {
    it('should create execution context with unique ID', () => {
      const input: AgentInput = {
        type: AgentType.CLASSIFIER,
        data: {},
      };

      const context1 = agent['createContext'](input);
      const context2 = agent['createContext'](input);

      expect(context1.executionId).not.toBe(context2.executionId);
    });

    it('should include project, feature, and requirement IDs from input context', () => {
      const input: AgentInput = {
        type: AgentType.CLASSIFIER,
        data: {},
        context: {
          executionId: 'exec-123',
          agentId: 'test',
          agentType: AgentType.CLASSIFIER,
          projectId: 'project-123',
          featureId: 'feature-456',
          requirementId: 'req-789',
          metadata: { custom: 'data' },
          startedAt: new Date(),
        },
      };

      const context = agent['createContext'](input);

      expect(context.projectId).toBe('project-123');
      expect(context.featureId).toBe('feature-456');
      expect(context.requirementId).toBe('req-789');
      expect(context.metadata).toEqual({ custom: 'data' });
    });

    it('should default metadata to empty object', () => {
      const input: AgentInput = {
        type: AgentType.CLASSIFIER,
        data: {},
      };

      const context = agent['createContext'](input);

      expect(context.metadata).toEqual({});
    });
  });

  describe('executeWithRetry()', () => {
    it('should retry on failure', async () => {
      const mockResponse: CompletionResponse = {
        content: '{"result": "success"}',
        model: 'claude-sonnet-4-5-20250929',
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
        requestId: 'req-123',
        latencyMs: 100,
      };

      vi.mocked(mockAdapter.complete)
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(mockResponse);

      const result = await agent['executeWithRetry']('test prompt');

      expect(result).toEqual(mockResponse);
      expect(mockAdapter.complete).toHaveBeenCalledTimes(2);
    });
  });
});
