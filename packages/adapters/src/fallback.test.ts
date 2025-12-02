// Fallback adapter tests

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FallbackAdapter, createFallbackAdapter, FallbackConfig } from './fallback.js';
import type { ModelAdapter, CompletionRequest, CompletionResponse } from '@entropy/shared';
import { CircuitState } from '@entropy/shared';

// Create mock adapter factory
function createMockAdapter(
  id: string,
  provider: 'anthropic' | 'openai' | 'google' = 'anthropic',
  options: {
    shouldFail?: boolean;
    failUntilAttempt?: number;
    streamError?: boolean;
    healthCheckResult?: boolean;
  } = {}
): ModelAdapter {
  let attempts = 0;

  return {
    id,
    provider,
    complete: vi.fn().mockImplementation(async () => {
      attempts++;
      if (options.shouldFail) {
        throw new Error(`${id} failed`);
      }
      if (options.failUntilAttempt && attempts < options.failUntilAttempt) {
        throw new Error(`${id} failed attempt ${attempts}`);
      }
      return {
        content: `Response from ${id}`,
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        model: 'test-model',
        latencyMs: 100,
        finishReason: 'stop',
        requestId: `req-${id}`,
      } as CompletionResponse;
    }),
    stream: vi.fn().mockImplementation(async function* () {
      if (options.streamError) {
        yield { type: 'error' as const, error: `${id} stream failed` };
        return;
      }
      yield { type: 'content' as const, content: `Streaming from ${id}` };
      yield { type: 'done' as const, usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } };
    }),
    countTokens: vi.fn().mockReturnValue(10),
    estimateCost: vi.fn().mockReturnValue(0.001),
    healthCheck: vi.fn().mockResolvedValue(options.healthCheckResult ?? true),
  };
}

describe('FallbackAdapter', () => {
  let mockAdapters: ModelAdapter[];
  let fallbackAdapter: FallbackAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapters = [
      createMockAdapter('primary', 'anthropic'),
      createMockAdapter('secondary', 'openai'),
      createMockAdapter('tertiary', 'google'),
    ];
    fallbackAdapter = new FallbackAdapter({ adapters: mockAdapters });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with adapter chain', () => {
      expect(fallbackAdapter.id).toBe('fallback');
      expect(fallbackAdapter.provider).toBe('anthropic'); // First adapter's provider
    });

    it('should use custom circuit breaker options', () => {
      const config: FallbackConfig = {
        adapters: mockAdapters,
        circuitBreakerOptions: {
          failureThreshold: 5,
          resetTimeoutMs: 60000,
          halfOpenMaxCalls: 2,
        },
      };

      const adapter = new FallbackAdapter(config);
      expect(adapter).toBeDefined();
    });
  });

  describe('complete()', () => {
    it('should use primary adapter when healthy', async () => {
      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'test-model',
      };

      const response = await fallbackAdapter.complete(request);

      expect(response.content).toBe('Response from primary');
      expect(response.requestId).toBe('req-primary');
      expect(mockAdapters[0].complete).toHaveBeenCalledWith(request);
      expect(mockAdapters[1].complete).not.toHaveBeenCalled();
    });

    it('should fallback to secondary when primary fails', async () => {
      mockAdapters = [
        createMockAdapter('primary', 'anthropic', { shouldFail: true }),
        createMockAdapter('secondary', 'openai'),
        createMockAdapter('tertiary', 'google'),
      ];
      fallbackAdapter = new FallbackAdapter({ adapters: mockAdapters });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'test-model',
      };

      const response = await fallbackAdapter.complete(request);

      expect(response.content).toBe('Response from secondary');
      expect(mockAdapters[0].complete).toHaveBeenCalled();
      expect(mockAdapters[1].complete).toHaveBeenCalled();
    });

    it('should fallback through entire chain if needed', async () => {
      mockAdapters = [
        createMockAdapter('primary', 'anthropic', { shouldFail: true }),
        createMockAdapter('secondary', 'openai', { shouldFail: true }),
        createMockAdapter('tertiary', 'google'),
      ];
      fallbackAdapter = new FallbackAdapter({ adapters: mockAdapters });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'test-model',
      };

      const response = await fallbackAdapter.complete(request);

      expect(response.content).toBe('Response from tertiary');
      expect(mockAdapters[2].complete).toHaveBeenCalled();
    });

    it('should throw error when all adapters fail', async () => {
      mockAdapters = [
        createMockAdapter('primary', 'anthropic', { shouldFail: true }),
        createMockAdapter('secondary', 'openai', { shouldFail: true }),
        createMockAdapter('tertiary', 'google', { shouldFail: true }),
      ];
      fallbackAdapter = new FallbackAdapter({ adapters: mockAdapters });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'test-model',
      };

      await expect(fallbackAdapter.complete(request)).rejects.toThrow('tertiary failed');
    });

    it('should open circuit breaker after repeated failures', async () => {
      const failingAdapter = createMockAdapter('always-fail', 'anthropic', { shouldFail: true });
      const healthyAdapter = createMockAdapter('healthy', 'openai');

      // Circuit breaker with low threshold
      const adapter = new FallbackAdapter({
        adapters: [failingAdapter, healthyAdapter],
        circuitBreakerOptions: {
          failureThreshold: 2,
          resetTimeoutMs: 30000,
          halfOpenMaxCalls: 1,
        },
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'test-model',
      };

      // First two calls will try failing adapter
      await adapter.complete(request);
      await adapter.complete(request);

      // Reset mock call count
      vi.mocked(failingAdapter.complete).mockClear();

      // Third call should skip the failing adapter (circuit open)
      await adapter.complete(request);

      // Circuit should be open, so failing adapter shouldn't be called
      expect(failingAdapter.complete).not.toHaveBeenCalled();
      expect(healthyAdapter.complete).toHaveBeenCalled();
    });
  });

  describe('stream()', () => {
    it('should stream from primary adapter when healthy', async () => {
      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'test-model',
      };

      const chunks: Array<{ type: string; content?: string }> = [];
      for await (const chunk of fallbackAdapter.stream(request)) {
        chunks.push(chunk);
      }

      expect(chunks[0].content).toBe('Streaming from primary');
      expect(chunks[chunks.length - 1].type).toBe('done');
    });

    it('should fallback to secondary on stream error', async () => {
      mockAdapters = [
        createMockAdapter('primary', 'anthropic', { streamError: true }),
        createMockAdapter('secondary', 'openai'),
      ];
      fallbackAdapter = new FallbackAdapter({ adapters: mockAdapters });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'test-model',
      };

      const chunks: Array<{ type: string; content?: string }> = [];
      for await (const chunk of fallbackAdapter.stream(request)) {
        chunks.push(chunk);
      }

      expect(chunks[0].content).toBe('Streaming from secondary');
    });

    it('should yield error chunk when all adapters fail', async () => {
      mockAdapters = [
        createMockAdapter('primary', 'anthropic', { streamError: true }),
        createMockAdapter('secondary', 'openai', { streamError: true }),
      ];
      fallbackAdapter = new FallbackAdapter({ adapters: mockAdapters });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'test-model',
      };

      const chunks: Array<{ type: string; error?: string }> = [];
      for await (const chunk of fallbackAdapter.stream(request)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('error');
      expect(chunks[0].error).toContain('secondary stream failed');
    });
  });

  describe('countTokens()', () => {
    it('should use first adapter for token counting', () => {
      const tokens = fallbackAdapter.countTokens('Hello world');

      expect(mockAdapters[0].countTokens).toHaveBeenCalledWith('Hello world');
      expect(tokens).toBe(10);
    });

    it('should return 0 if no adapters', () => {
      const emptyAdapter = new FallbackAdapter({ adapters: [] });
      expect(emptyAdapter.countTokens('test')).toBe(0);
    });
  });

  describe('estimateCost()', () => {
    it('should use first adapter for cost estimation', () => {
      const usage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };
      const cost = fallbackAdapter.estimateCost(usage);

      expect(mockAdapters[0].estimateCost).toHaveBeenCalledWith(usage);
      expect(cost).toBe(0.001);
    });

    it('should return 0 if no adapters', () => {
      const emptyAdapter = new FallbackAdapter({ adapters: [] });
      expect(emptyAdapter.estimateCost({ inputTokens: 0, outputTokens: 0, totalTokens: 0 })).toBe(
        0
      );
    });
  });

  describe('healthCheck()', () => {
    it('should return true if at least one adapter is healthy', async () => {
      mockAdapters = [
        createMockAdapter('unhealthy', 'anthropic', { healthCheckResult: false }),
        createMockAdapter('healthy', 'openai', { healthCheckResult: true }),
      ];
      fallbackAdapter = new FallbackAdapter({ adapters: mockAdapters });

      const isHealthy = await fallbackAdapter.healthCheck();

      expect(isHealthy).toBe(true);
    });

    it('should return false if all adapters are unhealthy', async () => {
      mockAdapters = [
        createMockAdapter('unhealthy1', 'anthropic', { healthCheckResult: false }),
        createMockAdapter('unhealthy2', 'openai', { healthCheckResult: false }),
      ];
      fallbackAdapter = new FallbackAdapter({ adapters: mockAdapters });

      const isHealthy = await fallbackAdapter.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should handle health check errors gracefully', async () => {
      const errorAdapter = createMockAdapter('error', 'anthropic');
      vi.mocked(errorAdapter.healthCheck).mockRejectedValue(new Error('Health check failed'));

      const healthyAdapter = createMockAdapter('healthy', 'openai', { healthCheckResult: true });

      fallbackAdapter = new FallbackAdapter({ adapters: [errorAdapter, healthyAdapter] });

      const isHealthy = await fallbackAdapter.healthCheck();

      expect(isHealthy).toBe(true);
    });
  });

  describe('getStatus()', () => {
    it('should return status for all adapters in chain', () => {
      const status = fallbackAdapter.getStatus();

      expect(status).toHaveLength(3);
      expect(status[0]).toEqual({
        id: 'primary',
        provider: 'anthropic',
        circuitState: CircuitState.CLOSED,
      });
      expect(status[1]).toEqual({
        id: 'secondary',
        provider: 'openai',
        circuitState: CircuitState.CLOSED,
      });
      expect(status[2]).toEqual({
        id: 'tertiary',
        provider: 'google',
        circuitState: CircuitState.CLOSED,
      });
    });

    it('should show open circuit state after failures', async () => {
      const failingAdapter = createMockAdapter('failing', 'anthropic', { shouldFail: true });
      const healthyAdapter = createMockAdapter('healthy', 'openai');

      const adapter = new FallbackAdapter({
        adapters: [failingAdapter, healthyAdapter],
        circuitBreakerOptions: {
          failureThreshold: 1,
          resetTimeoutMs: 30000,
          halfOpenMaxCalls: 1,
        },
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'test-model',
      };

      // Trigger circuit breaker
      await adapter.complete(request);

      const status = adapter.getStatus();

      expect(status[0].circuitState).toBe(CircuitState.OPEN);
      expect(status[1].circuitState).toBe(CircuitState.CLOSED);
    });
  });

  describe('getHealthyAdapter()', () => {
    it('should return first healthy adapter', async () => {
      const healthy = await fallbackAdapter.getHealthyAdapter();

      expect(healthy?.id).toBe('primary');
    });

    it('should skip adapters with open circuit', async () => {
      const failingAdapter = createMockAdapter('failing', 'anthropic', { shouldFail: true });
      const healthyAdapter = createMockAdapter('healthy', 'openai');

      const adapter = new FallbackAdapter({
        adapters: [failingAdapter, healthyAdapter],
        circuitBreakerOptions: {
          failureThreshold: 1,
          resetTimeoutMs: 30000,
          halfOpenMaxCalls: 1,
        },
      });

      // Trigger circuit breaker
      await adapter.complete({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'test-model',
      });

      const healthy = await adapter.getHealthyAdapter();

      expect(healthy?.id).toBe('healthy');
    });

    it('should return undefined if no healthy adapter found', async () => {
      mockAdapters = [
        createMockAdapter('unhealthy1', 'anthropic', { healthCheckResult: false }),
        createMockAdapter('unhealthy2', 'openai', { healthCheckResult: false }),
      ];
      fallbackAdapter = new FallbackAdapter({ adapters: mockAdapters });

      const healthy = await fallbackAdapter.getHealthyAdapter();

      expect(healthy).toBeUndefined();
    });
  });
});

describe('createFallbackAdapter()', () => {
  it('should create fallback adapter with adapters array', () => {
    const adapters: ModelAdapter[] = [
      createMockAdapter('adapter1', 'anthropic'),
      createMockAdapter('adapter2', 'openai'),
    ];

    const fallback = createFallbackAdapter(adapters);

    expect(fallback).toBeInstanceOf(FallbackAdapter);
    expect(fallback.id).toBe('fallback');
  });

  it('should accept custom circuit breaker options', () => {
    const adapters: ModelAdapter[] = [createMockAdapter('adapter1', 'anthropic')];

    const fallback = createFallbackAdapter(adapters, {
      failureThreshold: 10,
      resetTimeoutMs: 60000,
      halfOpenMaxCalls: 3,
    });

    expect(fallback).toBeInstanceOf(FallbackAdapter);
  });
});

describe('Circuit Breaker Integration', () => {
  it('should transition through circuit states correctly', async () => {
    const failingAdapter = createMockAdapter('failing', 'anthropic', { shouldFail: true });
    const healthyAdapter = createMockAdapter('healthy', 'openai');

    const fallback = new FallbackAdapter({
      adapters: [failingAdapter, healthyAdapter],
      circuitBreakerOptions: {
        failureThreshold: 2,
        resetTimeoutMs: 100, // Short timeout for testing
        halfOpenMaxCalls: 1,
      },
    });

    const request: CompletionRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'test-model',
    };

    // Trigger failures to open circuit
    await fallback.complete(request);
    await fallback.complete(request);

    let status = fallback.getStatus();
    expect(status[0].circuitState).toBe(CircuitState.OPEN);

    // Wait for reset timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Next call should transition to half-open
    await fallback.complete(request);

    // After failure in half-open, should be open again
    status = fallback.getStatus();
    expect(status[0].circuitState).toBe(CircuitState.OPEN);
  });

  it('should reset circuit on success in half-open state', async () => {
    let callCount = 0;
    const recoveringAdapter: ModelAdapter = {
      id: 'recovering',
      provider: 'anthropic',
      complete: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Failing');
        }
        return {
          content: 'Recovered',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'test-model',
          latencyMs: 100,
          finishReason: 'stop',
          requestId: 'req-recovered',
        } as CompletionResponse;
      }),
      stream: vi.fn(),
      countTokens: vi.fn().mockReturnValue(10),
      estimateCost: vi.fn().mockReturnValue(0.001),
      healthCheck: vi.fn().mockResolvedValue(true),
    };

    const fallback = new FallbackAdapter({
      adapters: [recoveringAdapter],
      circuitBreakerOptions: {
        failureThreshold: 2,
        resetTimeoutMs: 50,
        halfOpenMaxCalls: 1,
      },
    });

    const request: CompletionRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'test-model',
    };

    // Trigger failures
    try {
      await fallback.complete(request);
    } catch {
      // Expected
    }
    try {
      await fallback.complete(request);
    } catch {
      // Expected
    }

    // Wait for reset
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should succeed now and reset circuit
    const response = await fallback.complete(request);

    expect(response.content).toBe('Recovered');

    const status = fallback.getStatus();
    expect(status[0].circuitState).toBe(CircuitState.CLOSED);
  });
});
