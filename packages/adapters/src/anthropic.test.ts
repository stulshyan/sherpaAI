// Anthropic adapter tests
/* eslint-disable import/order */

import type { AdapterConfig, CompletionRequest } from '@entropy/shared';
import { AuthError, RateLimitError } from '@entropy/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Use vi.hoisted to define mocks that will be available when vi.mock is hoisted
const { mockCreate, mockStream, MockAPIError, MockAnthropic } = vi.hoisted(() => {
  const mockCreate = vi.fn();
  const mockStream = vi.fn();

  class MockAPIError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = 'APIError';
    }
  }

  const mockClient = {
    messages: {
      create: mockCreate,
      stream: mockStream,
    },
  };

  const MockAnthropic = Object.assign(vi.fn(() => mockClient), {
    APIError: MockAPIError,
  });

  return { mockCreate, mockStream, MockAPIError, MockAnthropic };
});

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: MockAnthropic,
  };
});

// Import AFTER mock
import { AnthropicAdapter } from './anthropic.js';

describe('AnthropicAdapter', () => {
  let adapter: AnthropicAdapter;
  const defaultConfig: AdapterConfig = {
    id: 'test-anthropic',
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    apiKey: 'test-api-key',
    maxRetries: 1,
    timeoutMs: 5000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new AnthropicAdapter(defaultConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('complete()', () => {
    it('should return CompletionResponse with all required fields', async () => {
      const mockResponse = {
        id: 'msg_12345',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello, world!' }],
        model: 'claude-sonnet-4-5-20250929',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Say hello' }],
        model: 'claude-sonnet-4-5-20250929',
      };

      const response = await adapter.complete(request);

      expect(response).toMatchObject({
        content: 'Hello, world!',
        model: 'claude-sonnet-4-5-20250929',
        finishReason: 'stop',
        requestId: 'msg_12345',
      });
      expect(response.usage).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      });
      expect(response.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should calculate cost correctly for Sonnet 4.5', async () => {
      const usage = {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      };

      const expectedCost = (1000 * 3.0) / 1_000_000 + (500 * 15.0) / 1_000_000;
      const cost = adapter.estimateCost(usage);

      expect(cost).toBeCloseTo(expectedCost, 6);
      expect(cost).toBeCloseTo(0.0105, 4);
    });

    it('should calculate cost correctly for Opus 4.5', async () => {
      const opusAdapter = new AnthropicAdapter({
        ...defaultConfig,
        model: 'claude-opus-4-5-20251101',
      });

      const usage = {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      };

      const expectedCost = (1000 * 15.0) / 1_000_000 + (500 * 75.0) / 1_000_000;
      const cost = opusAdapter.estimateCost(usage);

      expect(cost).toBeCloseTo(expectedCost, 6);
      expect(cost).toBeCloseTo(0.0525, 4);
    });

    it('should throw RateLimitError when rate limit is exceeded', async () => {
      const rateLimitError = new MockAPIError(429, 'Rate limit exceeded');
      mockCreate.mockRejectedValue(rateLimitError);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-sonnet-4-5-20250929',
      };

      await expect(adapter.complete(request)).rejects.toThrow(RateLimitError);
    });

    it('should throw AuthError on 401 response', async () => {
      const authError = new MockAPIError(401, 'Invalid API key');
      mockCreate.mockRejectedValue(authError);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-sonnet-4-5-20250929',
      };

      await expect(adapter.complete(request)).rejects.toThrow(AuthError);
    });

    it('should handle tool calls in response', async () => {
      const mockResponse = {
        id: 'msg_tools',
        content: [
          { type: 'text', text: 'I will search for that.' },
          {
            type: 'tool_use',
            id: 'tool_123',
            name: 'search',
            input: { query: 'hello world' },
          },
        ],
        model: 'claude-sonnet-4-5-20250929',
        stop_reason: 'tool_use',
        usage: { input_tokens: 20, output_tokens: 30 },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Search for hello' }],
        model: 'claude-sonnet-4-5-20250929',
        tools: [
          {
            name: 'search',
            description: 'Search for something',
            parameters: { type: 'object', properties: { query: { type: 'string' } } },
          },
        ],
      };

      const response = await adapter.complete(request);

      expect(response.finishReason).toBe('tool_use');
      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls?.[0]).toEqual({
        id: 'tool_123',
        name: 'search',
        arguments: { query: 'hello world' },
      });
    });

    it('should handle max_tokens finish reason', async () => {
      const mockResponse = {
        id: 'msg_maxed',
        content: [{ type: 'text', text: 'This is a long response that got...' }],
        model: 'claude-sonnet-4-5-20250929',
        stop_reason: 'max_tokens',
        usage: { input_tokens: 10, output_tokens: 100 },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Write something long' }],
        model: 'claude-sonnet-4-5-20250929',
        maxTokens: 100,
      };

      const response = await adapter.complete(request);

      expect(response.finishReason).toBe('length');
    });
  });

  describe('stream()', () => {
    it('should yield StreamChunk objects', async () => {
      const mockStreamObject = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Hello' },
          };
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: ' world' },
          };
        },
        finalMessage: vi.fn().mockResolvedValue({
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      };

      mockStream.mockResolvedValueOnce(mockStreamObject);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Say hello' }],
        model: 'claude-sonnet-4-5-20250929',
      };

      const chunks: Array<{ type: string; content?: string }> = [];
      for await (const chunk of adapter.stream(request)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks[0].type).toBe('content');
      expect(chunks[0].content).toBe('Hello');
      expect(chunks[1].content).toBe(' world');
    });

    it('should include final usage stats in last chunk', async () => {
      const mockStreamObject = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Done' },
          };
        },
        finalMessage: vi.fn().mockResolvedValue({
          usage: { input_tokens: 50, output_tokens: 25 },
        }),
      };

      mockStream.mockResolvedValueOnce(mockStreamObject);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-sonnet-4-5-20250929',
      };

      const chunks: Array<{
        type: string;
        usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
      }> = [];
      for await (const chunk of adapter.stream(request)) {
        chunks.push(chunk);
      }

      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk.type).toBe('done');
      expect(lastChunk.usage).toEqual({
        inputTokens: 50,
        outputTokens: 25,
        totalTokens: 75,
      });
    });

    it('should yield error chunk on stream failure', async () => {
      mockStream.mockRejectedValueOnce(new Error('Stream failed'));

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-sonnet-4-5-20250929',
      };

      const chunks: Array<{ type: string; error?: string }> = [];
      for await (const chunk of adapter.stream(request)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('error');
      expect(chunks[0].error).toBe('Stream failed');
    });
  });

  describe('countTokens()', () => {
    it('should estimate token count based on character length', () => {
      const text = 'Hello, world!';
      const tokens = adapter.countTokens(text);

      expect(tokens).toBe(Math.ceil(13 / 4));
      expect(tokens).toBe(4);
    });

    it('should handle empty string', () => {
      const tokens = adapter.countTokens('');
      expect(tokens).toBe(0);
    });

    it('should handle long text', () => {
      const text = 'a'.repeat(1000);
      const tokens = adapter.countTokens(text);
      expect(tokens).toBe(250);
    });
  });

  describe('healthCheck()', () => {
    it('should return true when API is reachable', async () => {
      mockCreate.mockResolvedValueOnce({
        id: 'msg_health',
        content: [{ type: 'text', text: 'pong' }],
        model: 'claude-sonnet-4-5-20250929',
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      });

      const isHealthy = await adapter.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should return false when API returns error', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API unavailable'));

      const isHealthy = await adapter.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('provider and id properties', () => {
    it('should have correct provider', () => {
      expect(adapter.provider).toBe('anthropic');
    });

    it('should have correct id from config', () => {
      expect(adapter.id).toBe('test-anthropic');
    });
  });

  describe('message conversion', () => {
    it('should filter out system messages from messages array', async () => {
      const mockResponse = {
        id: 'msg_sys',
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-sonnet-4-5-20250929',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const request: CompletionRequest = {
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
        ],
        model: 'claude-sonnet-4-5-20250929',
        systemPrompt: 'Be concise',
      };

      await adapter.complete(request);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'Be concise',
          messages: [{ role: 'user', content: 'Hello' }],
        })
      );
    });
  });

  describe('cost estimation with various models', () => {
    it.each([
      ['claude-sonnet-4-5-20250929', 3.0, 15.0],
      ['claude-opus-4-5-20251101', 15.0, 75.0],
      ['claude-3-5-sonnet-20241022', 3.0, 15.0],
      ['claude-3-opus-20240229', 15.0, 75.0],
      ['claude-3-haiku-20240307', 0.25, 1.25],
    ])('should calculate correct cost for %s', (model, inputPrice, outputPrice) => {
      const modelAdapter = new AnthropicAdapter({
        ...defaultConfig,
        model,
      });

      const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000, totalTokens: 2_000_000 };
      const cost = modelAdapter.estimateCost(usage);

      expect(cost).toBeCloseTo(inputPrice + outputPrice, 2);
    });

    it('should use default pricing for unknown model', () => {
      const unknownAdapter = new AnthropicAdapter({
        ...defaultConfig,
        model: 'claude-unknown-model',
      });

      const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000, totalTokens: 2_000_000 };
      const cost = unknownAdapter.estimateCost(usage);

      expect(cost).toBeCloseTo(18.0, 2);
    });
  });
});
