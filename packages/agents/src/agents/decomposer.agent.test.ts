// DecomposerAgent tests

import type { CompletionResponse, ModelAdapter } from '@entropy/shared';
import { AgentType } from '@entropy/shared';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OUTPUT_SCHEMAS } from '../validator.js';
import { DecomposerAgent, createDecomposerAgent } from './decomposer.agent.js';

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

describe('DecomposerAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create with default configuration', () => {
      const agent = new DecomposerAgent();

      expect(agent.id).toBe('decomposer-agent');
      expect(agent.type).toBe(AgentType.DECOMPOSER);
      expect(agent.config.modelId).toBe('claude-sonnet-4-5-20250929');
      expect(agent.config.fallbackModelIds).toEqual(['gpt-4o', 'gemini-1.5-pro']);
      expect(agent.config.maxRetries).toBe(3);
      expect(agent.config.timeoutMs).toBe(120000); // 2 minutes for complex tasks
      expect(agent.config.temperature).toBe(0.5);
      expect(agent.config.maxTokens).toBe(8192);
    });

    it('should allow configuration overrides', () => {
      const agent = new DecomposerAgent({
        modelId: 'gpt-4o',
        maxRetries: 5,
        temperature: 0.7,
        maxTokens: 4096,
      });

      expect(agent.config.modelId).toBe('gpt-4o');
      expect(agent.config.maxRetries).toBe(5);
      expect(agent.config.temperature).toBe(0.7);
      expect(agent.config.maxTokens).toBe(4096);
    });

    it('should use decomposition output schema', () => {
      const agent = new DecomposerAgent();

      expect(agent.config.outputSchema).toEqual(OUTPUT_SCHEMAS.decomposition);
    });
  });

  describe('buildPrompt()', () => {
    it('should build prompt with requirement and type', async () => {
      const agent = new DecomposerAgent();
      const input = {
        type: AgentType.DECOMPOSER,
        data: {
          requirementId: 'req-123',
          requirementText: 'Build e-commerce platform',
          requirementType: 'epic',
        },
      };

      const prompt = await agent.buildPrompt(input);

      expect(prompt).toContain('Build e-commerce platform');
      expect(prompt).toContain('epic');
      expect(prompt).toContain('themes');
      expect(prompt).toContain('atomicRequirements');
      expect(prompt).toContain('featureCandidates');
    });
  });

  describe('parseOutput()', () => {
    it('should parse JSON response', async () => {
      const agent = new DecomposerAgent();
      const response = JSON.stringify({
        themes: [{ id: 'theme-1', name: 'Test', description: 'Desc', confidence: 0.9 }],
        atomicRequirements: [{ id: 'ar-1', text: 'Test req', clarityScore: 0.8 }],
        featureCandidates: [
          {
            title: 'Feature',
            description: 'Desc',
            theme: 'theme-1',
            atomicRequirementIds: ['ar-1'],
          },
        ],
      });

      const result = await agent.parseOutput(response);

      expect(result.themes).toHaveLength(1);
      expect(result.atomicRequirements).toHaveLength(1);
      expect(result.featureCandidates).toHaveLength(1);
    });

    it('should extract JSON from markdown code block', async () => {
      const agent = new DecomposerAgent();
      const response = `Here's the decomposition:
\`\`\`json
{
  "themes": [],
  "atomicRequirements": [],
  "featureCandidates": []
}
\`\`\``;

      const result = await agent.parseOutput(response);

      expect(result.themes).toEqual([]);
      expect(result.atomicRequirements).toEqual([]);
      expect(result.featureCandidates).toEqual([]);
    });
  });

  describe('decompose()', () => {
    const mockDecompositionResponse: CompletionResponse = {
      content: JSON.stringify({
        themes: [
          {
            id: 'theme-auth',
            name: 'Authentication',
            description: 'User authentication and authorization',
            confidence: 0.95,
          },
          {
            id: 'theme-profile',
            name: 'User Profile',
            description: 'User profile management',
            confidence: 0.88,
          },
        ],
        atomicRequirements: [
          {
            id: 'ar-1',
            text: 'User can login with email/password',
            clarityScore: 0.95,
            theme: 'theme-auth',
            dependencies: [],
          },
          {
            id: 'ar-2',
            text: 'User can register a new account',
            clarityScore: 0.9,
            theme: 'theme-auth',
            dependencies: [],
          },
          {
            id: 'ar-3',
            text: 'User can view profile',
            clarityScore: 0.85,
            theme: 'theme-profile',
            dependencies: ['ar-1'],
          },
        ],
        featureCandidates: [
          {
            title: 'Login System',
            description: 'Email/password login functionality',
            theme: 'theme-auth',
            atomicRequirementIds: ['ar-1'],
            estimatedComplexity: 'medium',
            suggestedPriority: 1,
          },
          {
            title: 'Registration System',
            description: 'New user registration',
            theme: 'theme-auth',
            atomicRequirementIds: ['ar-2'],
            estimatedComplexity: 'medium',
            suggestedPriority: 2,
          },
        ],
        clarificationQuestions: [
          {
            question: 'Should we support social login (Google, GitHub)?',
            questionType: 'yes_no',
            priority: 'important',
          },
        ],
      }),
      model: 'claude-sonnet-4-5-20250929',
      usage: {
        inputTokens: 500,
        outputTokens: 800,
        totalTokens: 1300,
      },
      requestId: 'req-789',
      latencyMs: 2500,
    };

    beforeEach(() => {
      vi.mocked(mockAdapter.complete).mockResolvedValue(mockDecompositionResponse);
    });

    it('should decompose requirement and return structured result', async () => {
      const agent = new DecomposerAgent();

      const result = await agent.decompose('req-123', 'Build user management system', 'epic');

      expect(result.requirementId).toBe('req-123');
      expect(result.themes).toHaveLength(2);
      expect(result.atomicRequirements).toHaveLength(3);
      expect(result.featureCandidates).toHaveLength(2);
      expect(result.clarificationQuestions).toHaveLength(1);
    });

    it('should transform themes correctly', async () => {
      const agent = new DecomposerAgent();

      const result = await agent.decompose('req-123', 'Test', 'new_feature');

      const theme = result.themes[0]!;
      expect(theme.id).toBe('theme-auth');
      expect(theme.name).toBe('Authentication');
      expect(theme.description).toBe('User authentication and authorization');
      expect(theme.confidence).toBe(0.95);
      // Should include atomic requirement IDs for this theme
      expect(theme.atomicRequirementIds).toContain('ar-1');
      expect(theme.atomicRequirementIds).toContain('ar-2');
    });

    it('should transform atomic requirements correctly', async () => {
      const agent = new DecomposerAgent();

      const result = await agent.decompose('req-123', 'Test', 'new_feature');

      const ar = result.atomicRequirements[0]!;
      expect(ar.id).toBe('ar-1');
      expect(ar.text).toBe('User can login with email/password');
      expect(ar.clarityScore).toBe(0.95);
      expect(ar.theme).toBe('theme-auth');
      expect(ar.dependencies).toEqual([]);
      expect(ar.order).toBe(0);
    });

    it('should transform feature candidates correctly', async () => {
      const agent = new DecomposerAgent();

      const result = await agent.decompose('req-123', 'Test', 'new_feature');

      const feature = result.featureCandidates[0]!;
      expect(feature.title).toBe('Login System');
      expect(feature.description).toBe('Email/password login functionality');
      expect(feature.theme).toBe('theme-auth');
      expect(feature.atomicRequirementIds).toEqual(['ar-1']);
      expect(feature.estimatedComplexity).toBe('medium');
      expect(feature.suggestedPriority).toBe(1);
    });

    it('should transform clarification questions correctly', async () => {
      const agent = new DecomposerAgent();

      const result = await agent.decompose('req-123', 'Test', 'new_feature');

      const question = result.clarificationQuestions[0]!;
      expect(question.question).toBe('Should we support social login (Google, GitHub)?');
      expect(question.questionType).toBe('yes_no');
      expect(question.priority).toBe('important');
      expect(question.id).toBeDefined(); // Should have generated UUID
    });

    it('should include processing time and model', async () => {
      const agent = new DecomposerAgent();

      const result = await agent.decompose('req-123', 'Test', 'new_feature');

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.model).toBe('claude-sonnet-4-5-20250929');
    });

    it('should handle missing clarification questions', async () => {
      vi.mocked(mockAdapter.complete).mockResolvedValue({
        ...mockDecompositionResponse,
        content: JSON.stringify({
          themes: [],
          atomicRequirements: [],
          featureCandidates: [],
          // No clarificationQuestions field
        }),
      });

      const agent = new DecomposerAgent();
      const result = await agent.decompose('req-123', 'Test', 'new_feature');

      expect(result.clarificationQuestions).toEqual([]);
    });

    it('should provide default complexity when not specified', async () => {
      vi.mocked(mockAdapter.complete).mockResolvedValue({
        ...mockDecompositionResponse,
        content: JSON.stringify({
          themes: [],
          atomicRequirements: [],
          featureCandidates: [
            {
              title: 'Test Feature',
              description: 'Test',
              theme: 'theme-1',
              atomicRequirementIds: [],
              // No estimatedComplexity or suggestedPriority
            },
          ],
        }),
      });

      const agent = new DecomposerAgent();
      const result = await agent.decompose('req-123', 'Test', 'new_feature');

      expect(result.featureCandidates[0]!.estimatedComplexity).toBe('medium');
      expect(result.featureCandidates[0]!.suggestedPriority).toBe(5);
    });

    it('should call adapter with correct request', async () => {
      const agent = new DecomposerAgent();

      await agent.decompose('req-123', 'Test requirement', 'epic');

      expect(mockAdapter.complete).toHaveBeenCalledTimes(1);
      const request = vi.mocked(mockAdapter.complete).mock.calls[0]![0];

      expect(request.model).toBe('claude-sonnet-4-5-20250929');
      expect(request.maxTokens).toBe(8192);
      expect(request.temperature).toBe(0.5);
      expect(request.messages[0]!.content).toContain('Test requirement');
      expect(request.messages[0]!.content).toContain('epic');
    });
  });

  describe('createDecomposerAgent()', () => {
    it('should create agent with default config', () => {
      const agent = createDecomposerAgent();

      expect(agent).toBeInstanceOf(DecomposerAgent);
      expect(agent.config.modelId).toBe('claude-sonnet-4-5-20250929');
    });

    it('should create agent with custom model', () => {
      const agent = createDecomposerAgent('gpt-4o');

      expect(agent).toBeInstanceOf(DecomposerAgent);
      expect(agent.config.modelId).toBe('gpt-4o');
    });
  });
});
