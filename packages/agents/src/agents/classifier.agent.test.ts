// ClassifierAgent tests

import type { CompletionResponse, ModelAdapter } from '@entropy/shared';
import { AgentType } from '@entropy/shared';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OUTPUT_SCHEMAS } from '../validator.js';
import { ClassifierAgent, createClassifierAgent } from './classifier.agent.js';

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

// Mock the adapter registry
vi.mock('@entropy/adapters', () => ({
  getAdapterRegistry: vi.fn(() => ({
    get: vi.fn(() => mockAdapter),
  })),
}));

describe('ClassifierAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create with default configuration', () => {
      const agent = new ClassifierAgent();

      expect(agent.id).toBe('classifier-agent');
      expect(agent.type).toBe(AgentType.CLASSIFIER);
      expect(agent.config.modelId).toBe('claude-sonnet-4-5-20250929');
      expect(agent.config.fallbackModelIds).toEqual(['gpt-4o']);
      expect(agent.config.maxRetries).toBe(3);
      expect(agent.config.timeoutMs).toBe(30000);
      expect(agent.config.temperature).toBe(0.3);
      expect(agent.config.maxTokens).toBe(1024);
    });

    it('should allow configuration overrides', () => {
      const agent = new ClassifierAgent({
        modelId: 'gpt-4o',
        maxRetries: 5,
        temperature: 0.5,
      });

      expect(agent.config.modelId).toBe('gpt-4o');
      expect(agent.config.maxRetries).toBe(5);
      expect(agent.config.temperature).toBe(0.5);
    });

    it('should use classification output schema', () => {
      const agent = new ClassifierAgent();

      expect(agent.config.outputSchema).toEqual(OUTPUT_SCHEMAS.classification);
    });
  });

  describe('buildPrompt()', () => {
    it('should build prompt with requirement text', async () => {
      const agent = new ClassifierAgent();
      const input = {
        type: AgentType.CLASSIFIER,
        data: {
          requirementId: 'req-123',
          requirementText: 'Build user authentication system',
        },
      };

      const prompt = await agent.buildPrompt(input);

      expect(prompt).toContain('Build user authentication system');
      expect(prompt).toContain('new_feature');
      expect(prompt).toContain('enhancement');
      expect(prompt).toContain('epic');
      expect(prompt).toContain('bug_fix');
    });
  });

  describe('parseOutput()', () => {
    it('should parse JSON response', async () => {
      const agent = new ClassifierAgent();
      const response = JSON.stringify({
        type: 'new_feature',
        confidence: 0.9,
        reasoning: 'Test reasoning',
        suggestedDecomposition: true,
      });

      const result = await agent.parseOutput(response);

      expect(result.type).toBe('new_feature');
      expect(result.confidence).toBe(0.9);
      expect(result.reasoning).toBe('Test reasoning');
      expect(result.suggestedDecomposition).toBe(true);
    });

    it('should extract JSON from markdown code block', async () => {
      const agent = new ClassifierAgent();
      const response = `Here's the classification:
\`\`\`json
{
  "type": "enhancement",
  "confidence": 0.85,
  "reasoning": "Improves existing feature",
  "suggestedDecomposition": false
}
\`\`\``;

      const result = await agent.parseOutput(response);

      expect(result.type).toBe('enhancement');
      expect(result.confidence).toBe(0.85);
    });
  });

  describe('classify()', () => {
    const mockClassificationResponse: CompletionResponse = {
      content: JSON.stringify({
        type: 'new_feature',
        confidence: 0.92,
        reasoning: 'This is a new capability for user authentication',
        suggestedDecomposition: true,
      }),
      model: 'claude-sonnet-4-5-20250929',
      usage: {
        inputTokens: 150,
        outputTokens: 75,
        totalTokens: 225,
      },
      requestId: 'req-456',
      latencyMs: 450,
    };

    beforeEach(() => {
      vi.mocked(mockAdapter.complete).mockResolvedValue(mockClassificationResponse);
    });

    it('should classify requirement and return typed result', async () => {
      const agent = new ClassifierAgent();

      const result = await agent.classify('req-123', 'Build user authentication system');

      expect(result.requirementId).toBe('req-123');
      expect(result.type).toBe('new_feature');
      expect(result.confidence).toBe(0.92);
      expect(result.reasoning).toBe('This is a new capability for user authentication');
      expect(result.suggestedDecomposition).toBe(true);
    });

    it('should call adapter with correct request', async () => {
      const agent = new ClassifierAgent();

      await agent.classify('req-123', 'Test requirement');

      expect(mockAdapter.complete).toHaveBeenCalledTimes(1);
      const request = vi.mocked(mockAdapter.complete).mock.calls[0]![0];

      expect(request.model).toBe('claude-sonnet-4-5-20250929');
      expect(request.maxTokens).toBe(1024);
      expect(request.temperature).toBe(0.3);
      expect(request.messages[0]!.content).toContain('Test requirement');
    });
  });

  describe('createClassifierAgent()', () => {
    it('should create agent with default config', () => {
      const agent = createClassifierAgent();

      expect(agent).toBeInstanceOf(ClassifierAgent);
      expect(agent.config.modelId).toBe('claude-sonnet-4-5-20250929');
    });

    it('should create agent with custom model', () => {
      const agent = createClassifierAgent('gpt-4o');

      expect(agent).toBeInstanceOf(ClassifierAgent);
      expect(agent.config.modelId).toBe('gpt-4o');
    });
  });
});
