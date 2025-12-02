// Google Gemini adapter tests

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CompletionRequest, AdapterConfig } from '@entropy/shared';
import { RateLimitError, AuthError, TimeoutError } from '@entropy/shared';

// Define mock functions at module level BEFORE the mock
const mockGenerateContent = vi.fn();
const mockGenerateContentStream = vi.fn();

// Mock the Google Generative AI SDK
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockImplementation(() => ({
        generateContent: mockGenerateContent,
        generateContentStream: mockGenerateContentStream,
      })),
    })),
  };
});

// Import AFTER mock
import { GoogleAdapter } from './google.js';

describe('GoogleAdapter', () => {
  let adapter: GoogleAdapter;
  const defaultConfig: AdapterConfig = {
    id: 'test-google',
    provider: 'google',
    model: 'gemini-1.5-pro',
    apiKey: 'test-api-key',
    maxRetries: 1,
    timeoutMs: 5000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new GoogleAdapter(defaultConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('complete()', () => {
    it('should return CompletionResponse with all required fields', async () => {
      const mockResponse = {
        response: {
          text: () => 'Hello, world!',
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
          candidates: [{ finishReason: 'STOP' }],
        },
      };

      mockGenerateContent.mockResolvedValueOnce(mockResponse);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Say hello' }],
        model: 'gemini-1.5-pro',
      };

      const response = await adapter.complete(request);

      expect(response).toMatchObject({
        content: 'Hello, world!',
        model: 'gemini-1.5-pro',
        finishReason: 'stop',
      });
      expect(response.usage).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      });
      expect(response.latencyMs).toBeGreaterThanOrEqual(0);
      expect(response.requestId).toMatch(/^google-\d+-[a-z0-9]+$/);
    });

    it('should calculate cost correctly for Gemini 1.5 Pro', async () => {
      const usage = {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      };

      // Gemini 1.5 Pro pricing: $1.25/1M input, $5.00/1M output
      const expectedCost = (1000 * 1.25) / 1_000_000 + (500 * 5.0) / 1_000_000;
      const cost = adapter.estimateCost(usage);

      expect(cost).toBeCloseTo(expectedCost, 6);
      expect(cost).toBeCloseTo(0.00375, 5);
    });

    it('should calculate cost correctly for Gemini 1.5 Flash', async () => {
      const flashAdapter = new GoogleAdapter({
        ...defaultConfig,
        model: 'gemini-1.5-flash',
      });

      const usage = {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      };

      // Gemini 1.5 Flash pricing: $0.075/1M input, $0.30/1M output
      const expectedCost = (1000 * 0.075) / 1_000_000 + (500 * 0.3) / 1_000_000;
      const cost = flashAdapter.estimateCost(usage);

      expect(cost).toBeCloseTo(expectedCost, 6);
    });

    it('should throw RateLimitError on 429 response', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('429 Rate limit exceeded'));

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gemini-1.5-pro',
      };

      await expect(adapter.complete(request)).rejects.toThrow(RateLimitError);
    });

    it('should throw AuthError on API key error', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('401 API key not valid'));

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gemini-1.5-pro',
      };

      await expect(adapter.complete(request)).rejects.toThrow(AuthError);
    });

    it('should throw TimeoutError on timeout', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('Request timeout'));

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gemini-1.5-pro',
      };

      await expect(adapter.complete(request)).rejects.toThrow(TimeoutError);
    });

    it('should handle STOP finish reason', async () => {
      const mockResponse = {
        response: {
          text: () => 'Normal response',
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
          candidates: [{ finishReason: 'STOP' }],
        },
      };

      mockGenerateContent.mockResolvedValueOnce(mockResponse);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gemini-1.5-pro',
      };

      const response = await adapter.complete(request);
      expect(response.finishReason).toBe('stop');
    });

    it('should handle MAX_TOKENS finish reason', async () => {
      const mockResponse = {
        response: {
          text: () => 'Truncated...',
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 100,
            totalTokenCount: 110,
          },
          candidates: [{ finishReason: 'MAX_TOKENS' }],
        },
      };

      mockGenerateContent.mockResolvedValueOnce(mockResponse);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Write long' }],
        model: 'gemini-1.5-pro',
        maxTokens: 100,
      };

      const response = await adapter.complete(request);
      expect(response.finishReason).toBe('length');
    });

    it('should handle SAFETY finish reason as error', async () => {
      const mockResponse = {
        response: {
          text: () => '',
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 0,
            totalTokenCount: 10,
          },
          candidates: [{ finishReason: 'SAFETY' }],
        },
      };

      mockGenerateContent.mockResolvedValueOnce(mockResponse);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Something unsafe' }],
        model: 'gemini-1.5-pro',
      };

      const response = await adapter.complete(request);
      expect(response.finishReason).toBe('error');
    });

    it('should estimate token count when usageMetadata is missing', async () => {
      const mockResponse = {
        response: {
          text: () => 'Response without metadata',
          usageMetadata: undefined,
          candidates: [{ finishReason: 'STOP' }],
        },
      };

      mockGenerateContent.mockResolvedValueOnce(mockResponse);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gemini-1.5-pro',
      };

      const response = await adapter.complete(request);
      expect(response.usage.inputTokens).toBeGreaterThan(0);
      expect(response.usage.outputTokens).toBeGreaterThan(0);
    });
  });

  describe('stream()', () => {
    it('should yield StreamChunk objects', async () => {
      const mockStreamResult = {
        stream: (async function* () {
          yield { text: () => 'Hello' };
          yield { text: () => ' world' };
        })(),
        response: Promise.resolve({
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
        }),
      };

      mockGenerateContentStream.mockResolvedValueOnce(mockStreamResult);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Say hello' }],
        model: 'gemini-1.5-pro',
      };

      const chunks: Array<{ type: string; content?: string }> = [];
      for await (const chunk of adapter.stream(request)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks[0].type).toBe('content');
      expect(chunks[0].content).toBe('Hello');
    });

    it('should include usage stats in final chunk', async () => {
      const mockStreamResult = {
        stream: (async function* () {
          yield { text: () => 'Done' };
        })(),
        response: Promise.resolve({
          usageMetadata: {
            promptTokenCount: 50,
            candidatesTokenCount: 25,
            totalTokenCount: 75,
          },
        }),
      };

      mockGenerateContentStream.mockResolvedValueOnce(mockStreamResult);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gemini-1.5-pro',
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
      mockGenerateContentStream.mockRejectedValueOnce(new Error('Stream failed'));

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gemini-1.5-pro',
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
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => 'pong',
        },
      });

      const isHealthy = await adapter.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should return false when API returns error', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('API unavailable'));

      const isHealthy = await adapter.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('provider and id properties', () => {
    it('should have correct provider', () => {
      expect(adapter.provider).toBe('google');
    });

    it('should have correct id from config', () => {
      expect(adapter.id).toBe('test-google');
    });
  });

  describe('message conversion', () => {
    it('should filter out system messages and convert to Gemini format', async () => {
      const mockResponse = {
        response: {
          text: () => 'Response',
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
          candidates: [{ finishReason: 'STOP' }],
        },
      };

      mockGenerateContent.mockResolvedValueOnce(mockResponse);

      const request: CompletionRequest = {
        messages: [
          { role: 'system', content: 'System instruction' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
        ],
        model: 'gemini-1.5-pro',
      };

      await adapter.complete(request);

      // Verify generateContent was called - messages should be converted
      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it('should convert assistant role to model role', async () => {
      const mockResponse = {
        response: {
          text: () => 'Response',
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
          candidates: [{ finishReason: 'STOP' }],
        },
      };

      mockGenerateContent.mockResolvedValueOnce(mockResponse);

      const request: CompletionRequest = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi' },
          { role: 'user', content: 'How are you?' },
        ],
        model: 'gemini-1.5-pro',
      };

      await adapter.complete(request);

      // The adapter should have been called with converted messages
      expect(mockGenerateContent).toHaveBeenCalledWith({
        contents: expect.arrayContaining([
          { role: 'user', parts: [{ text: 'Hello' }] },
          { role: 'model', parts: [{ text: 'Hi' }] },
          { role: 'user', parts: [{ text: 'How are you?' }] },
        ]),
      });
    });
  });

  describe('cost estimation with various models', () => {
    it.each([
      ['gemini-1.5-pro', 1.25, 5.0],
      ['gemini-1.5-flash', 0.075, 0.3],
      ['gemini-1.0-pro', 0.5, 1.5],
    ])('should calculate correct cost for %s', (model, inputPrice, outputPrice) => {
      const modelAdapter = new GoogleAdapter({
        ...defaultConfig,
        model,
      });

      const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000, totalTokens: 2_000_000 };
      const cost = modelAdapter.estimateCost(usage);

      expect(cost).toBeCloseTo(inputPrice + outputPrice, 2);
    });

    it('should use default pricing for unknown model', () => {
      const unknownAdapter = new GoogleAdapter({
        ...defaultConfig,
        model: 'gemini-unknown-model',
      });

      const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000, totalTokens: 2_000_000 };
      const cost = unknownAdapter.estimateCost(usage);

      // Default: $1.25 input, $5.00 output
      expect(cost).toBeCloseTo(6.25, 2);
    });
  });

  describe('error handling edge cases', () => {
    it('should handle rate limit message in error', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('rate limit reached'));

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gemini-1.5-pro',
      };

      await expect(adapter.complete(request)).rejects.toThrow(RateLimitError);
    });

    it('should handle generic errors', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('Unknown API error'));

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gemini-1.5-pro',
      };

      await expect(adapter.complete(request)).rejects.toThrow('Unknown API error');
    });
  });
});
