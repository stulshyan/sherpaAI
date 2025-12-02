// OpenAI adapter tests
/* eslint-disable import/order */

import type { AdapterConfig, CompletionRequest } from '@entropy/shared';
import { AuthError, RateLimitError, TimeoutError } from '@entropy/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Use vi.hoisted to define mocks that will be available when vi.mock is hoisted
const { mockCreate, MockAPIError, MockOpenAI } = vi.hoisted(() => {
  const mockCreate = vi.fn();

  class MockAPIError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = 'APIError';
    }
  }

  const mockClient = {
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  };

  const MockOpenAI = Object.assign(
    vi.fn(() => mockClient),
    {
      APIError: MockAPIError,
    }
  );

  return { mockCreate, MockAPIError, MockOpenAI };
});

// Mock the OpenAI SDK
vi.mock('openai', () => {
  return {
    default: MockOpenAI,
  };
});

// Import AFTER mock
import { OpenAIAdapter } from './openai.js';

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;
  const defaultConfig: AdapterConfig = {
    id: 'test-openai',
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: 'test-api-key',
    maxRetries: 1,
    timeoutMs: 5000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new OpenAIAdapter(defaultConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('complete()', () => {
    it('should return CompletionResponse with all required fields', async () => {
      const mockResponse = {
        id: 'chatcmpl-12345',
        choices: [
          {
            message: { content: 'Hello, world!', role: 'assistant' },
            finish_reason: 'stop',
          },
        ],
        model: 'gpt-4o',
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Say hello' }],
        model: 'gpt-4o',
      };

      const response = await adapter.complete(request);

      expect(response).toMatchObject({
        content: 'Hello, world!',
        model: 'gpt-4o',
        finishReason: 'stop',
        requestId: 'chatcmpl-12345',
      });
      expect(response.usage).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      });
      expect(response.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should calculate cost correctly for GPT-4o', async () => {
      const usage = {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      };

      // GPT-4o pricing: $2.50/1M input, $10.00/1M output
      const expectedCost = (1000 * 2.5) / 1_000_000 + (500 * 10.0) / 1_000_000;
      const cost = adapter.estimateCost(usage);

      expect(cost).toBeCloseTo(expectedCost, 6);
      expect(cost).toBeCloseTo(0.0075, 4);
    });

    it('should calculate cost correctly for GPT-4o-mini', async () => {
      const miniAdapter = new OpenAIAdapter({
        ...defaultConfig,
        model: 'gpt-4o-mini',
      });

      const usage = {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      };

      // GPT-4o-mini pricing: $0.15/1M input, $0.60/1M output
      const expectedCost = (1000 * 0.15) / 1_000_000 + (500 * 0.6) / 1_000_000;
      const cost = miniAdapter.estimateCost(usage);

      expect(cost).toBeCloseTo(expectedCost, 6);
    });

    it('should throw RateLimitError when rate limit is exceeded', async () => {
      const rateLimitError = new MockAPIError(429, 'Rate limit exceeded');
      mockCreate.mockRejectedValue(rateLimitError);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o',
      };

      await expect(adapter.complete(request)).rejects.toThrow(RateLimitError);
    });

    it('should throw AuthError on 401 response', async () => {
      const authError = new MockAPIError(401, 'Invalid API key');
      mockCreate.mockRejectedValue(authError);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o',
      };

      await expect(adapter.complete(request)).rejects.toThrow(AuthError);
    });

    it('should throw TimeoutError on timeout', async () => {
      const timeoutError = new MockAPIError(408, 'timeout');
      mockCreate.mockRejectedValue(timeoutError);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o',
      };

      await expect(adapter.complete(request)).rejects.toThrow(TimeoutError);
    });

    it('should handle tool calls in response', async () => {
      const mockResponse = {
        id: 'chatcmpl-tools',
        choices: [
          {
            message: {
              content: null,
              role: 'assistant',
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'search',
                    arguments: JSON.stringify({ query: 'hello world' }),
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        model: 'gpt-4o',
        usage: {
          prompt_tokens: 20,
          completion_tokens: 30,
          total_tokens: 50,
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Search for hello' }],
        model: 'gpt-4o',
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
        id: 'call_123',
        name: 'search',
        arguments: { query: 'hello world' },
      });
    });

    it('should handle length finish reason', async () => {
      const mockResponse = {
        id: 'chatcmpl-length',
        choices: [
          {
            message: { content: 'Truncated...', role: 'assistant' },
            finish_reason: 'length',
          },
        ],
        model: 'gpt-4o',
        usage: { prompt_tokens: 10, completion_tokens: 100, total_tokens: 110 },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Write something long' }],
        model: 'gpt-4o',
        maxTokens: 100,
      };

      const response = await adapter.complete(request);
      expect(response.finishReason).toBe('length');
    });

    it('should handle JSON response format', async () => {
      const mockResponse = {
        id: 'chatcmpl-json',
        choices: [
          {
            message: { content: '{"key": "value"}', role: 'assistant' },
            finish_reason: 'stop',
          },
        ],
        model: 'gpt-4o',
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Return JSON' }],
        model: 'gpt-4o',
        responseFormat: 'json',
      };

      await adapter.complete(request);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: { type: 'json_object' },
        })
      );
    });

    it('should handle stop sequences', async () => {
      const mockResponse = {
        id: 'chatcmpl-stop',
        choices: [
          {
            message: { content: 'Output', role: 'assistant' },
            finish_reason: 'stop',
          },
        ],
        model: 'gpt-4o',
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o',
        stopSequences: ['END', 'STOP'],
      };

      await adapter.complete(request);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          stop: ['END', 'STOP'],
        })
      );
    });
  });

  describe('stream()', () => {
    it('should yield StreamChunk objects', async () => {
      const mockStreamIterator = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: 'Hello' } }] };
          yield { choices: [{ delta: { content: ' world' } }] };
        },
      };

      mockCreate.mockResolvedValueOnce(mockStreamIterator);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Say hello' }],
        model: 'gpt-4o',
      };

      const chunks: Array<{ type: string; content?: string }> = [];
      for await (const chunk of adapter.stream(request)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks[0].type).toBe('content');
      expect(chunks[0].content).toBe('Hello');
    });

    it('should include estimated usage in final chunk', async () => {
      const mockStreamIterator = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: 'Done' } }] };
        },
      };

      mockCreate.mockResolvedValueOnce(mockStreamIterator);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o',
      };

      const chunks: Array<{ type: string; usage?: { inputTokens: number; outputTokens: number } }> =
        [];
      for await (const chunk of adapter.stream(request)) {
        chunks.push(chunk);
      }

      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk.type).toBe('done');
      expect(lastChunk.usage).toBeDefined();
    });

    it('should yield error chunk on stream failure', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Stream failed'));

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o',
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
    });

    it('should handle empty string', () => {
      const tokens = adapter.countTokens('');
      expect(tokens).toBe(0);
    });
  });

  describe('healthCheck()', () => {
    it('should return true when API is reachable', async () => {
      mockCreate.mockResolvedValueOnce({
        id: 'chatcmpl-health',
        choices: [{ message: { content: 'pong' }, finish_reason: 'stop' }],
        model: 'gpt-4o',
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
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
      expect(adapter.provider).toBe('openai');
    });

    it('should have correct id from config', () => {
      expect(adapter.id).toBe('test-openai');
    });
  });

  describe('message conversion', () => {
    it('should include system prompt as first message', async () => {
      const mockResponse = {
        id: 'chatcmpl-sys',
        choices: [
          {
            message: { content: 'Response', role: 'assistant' },
            finish_reason: 'stop',
          },
        ],
        model: 'gpt-4o',
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o',
        systemPrompt: 'You are helpful',
      };

      await adapter.complete(request);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([{ role: 'system', content: 'You are helpful' }]),
        })
      );
    });

    it('should handle tool message with tool_call_id', async () => {
      const mockResponse = {
        id: 'chatcmpl-tool-resp',
        choices: [
          {
            message: { content: 'Processed', role: 'assistant' },
            finish_reason: 'stop',
          },
        ],
        model: 'gpt-4o',
        usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const request: CompletionRequest = {
        messages: [
          { role: 'user', content: 'Search for cats' },
          {
            role: 'assistant',
            content: '',
          },
          { role: 'tool', content: '{"results": []}', toolCallId: 'call_abc' },
        ],
        model: 'gpt-4o',
      };

      await adapter.complete(request);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'tool', content: '{"results": []}', tool_call_id: 'call_abc' },
          ]),
        })
      );
    });
  });

  describe('cost estimation with various models', () => {
    it.each([
      ['gpt-4o', 2.5, 10.0],
      ['gpt-4o-mini', 0.15, 0.6],
      ['gpt-4-turbo', 10.0, 30.0],
      ['gpt-4', 30.0, 60.0],
      ['gpt-3.5-turbo', 0.5, 1.5],
    ])('should calculate correct cost for %s', (model, inputPrice, outputPrice) => {
      const modelAdapter = new OpenAIAdapter({
        ...defaultConfig,
        model,
      });

      const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000, totalTokens: 2_000_000 };
      const cost = modelAdapter.estimateCost(usage);

      expect(cost).toBeCloseTo(inputPrice + outputPrice, 2);
    });

    it('should use default pricing for unknown model', () => {
      const unknownAdapter = new OpenAIAdapter({
        ...defaultConfig,
        model: 'gpt-unknown-model',
      });

      const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000, totalTokens: 2_000_000 };
      const cost = unknownAdapter.estimateCost(usage);

      // Default: $2.50 input, $10.00 output
      expect(cost).toBeCloseTo(12.5, 2);
    });
  });
});
