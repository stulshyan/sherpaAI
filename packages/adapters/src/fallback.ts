// Fallback adapter with automatic failover

import type {
  ModelAdapter,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  TokenUsage,
  ModelProvider,
} from '@entropy/shared';
import { createLogger, CircuitBreaker, CircuitState } from '@entropy/shared';

const logger = createLogger('fallback-adapter');

export interface FallbackConfig {
  adapters: ModelAdapter[];
  circuitBreakerOptions?: {
    failureThreshold: number;
    resetTimeoutMs: number;
    halfOpenMaxCalls: number;
  };
}

interface AdapterWithBreaker {
  adapter: ModelAdapter;
  breaker: CircuitBreaker;
}

/**
 * Fallback adapter that tries multiple adapters in sequence
 * with circuit breaker pattern for each
 */
export class FallbackAdapter implements ModelAdapter {
  readonly id: string = 'fallback';
  readonly provider: ModelProvider = 'anthropic'; // Primary provider

  private adaptersWithBreakers: AdapterWithBreaker[];

  constructor(config: FallbackConfig) {
    const breakerOptions = config.circuitBreakerOptions || {
      failureThreshold: 3,
      resetTimeoutMs: 30000,
      halfOpenMaxCalls: 1,
    };

    this.adaptersWithBreakers = config.adapters.map((adapter) => ({
      adapter,
      breaker: new CircuitBreaker(breakerOptions),
    }));

    if (config.adapters.length > 0) {
      this.provider = config.adapters[0]!.provider;
    }

    logger.info('Fallback adapter initialized', {
      adapterCount: config.adapters.length,
      adapterIds: config.adapters.map((a) => a.id),
    });
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    let lastError: Error | undefined;

    for (const { adapter, breaker } of this.adaptersWithBreakers) {
      // Skip if circuit is open
      if (breaker.getState() === CircuitState.OPEN) {
        logger.debug('Skipping adapter with open circuit', { id: adapter.id });
        continue;
      }

      try {
        const startTime = Date.now();
        const response = await breaker.execute(() =>
          adapter.complete(request)
        );

        logger.info('Fallback request succeeded', {
          adapterId: adapter.id,
          latencyMs: Date.now() - startTime,
        });

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        logger.warn('Fallback adapter failed, trying next', {
          adapterId: adapter.id,
          error: lastError.message,
          circuitState: breaker.getState(),
        });
      }
    }

    throw lastError || new Error('All fallback adapters failed');
  }

  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    let lastError: Error | undefined;

    for (const { adapter, breaker } of this.adaptersWithBreakers) {
      if (breaker.getState() === CircuitState.OPEN) {
        continue;
      }

      try {
        // For streaming, we need to handle errors during iteration
        const generator = adapter.stream(request);

        for await (const chunk of generator) {
          if (chunk.type === 'error') {
            throw new Error(chunk.error);
          }
          yield chunk;
        }

        // If we got here without error, return
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn('Fallback stream failed, trying next', {
          adapterId: adapter.id,
          error: lastError.message,
        });
      }
    }

    yield {
      type: 'error',
      error: lastError?.message || 'All fallback adapters failed',
    };
  }

  countTokens(text: string): number {
    // Use first available adapter for token counting
    return this.adaptersWithBreakers[0]?.adapter.countTokens(text) || 0;
  }

  estimateCost(tokens: TokenUsage): number {
    // Use first available adapter for cost estimation
    return this.adaptersWithBreakers[0]?.adapter.estimateCost(tokens) || 0;
  }

  async healthCheck(): Promise<boolean> {
    // Consider healthy if at least one adapter is healthy
    for (const { adapter } of this.adaptersWithBreakers) {
      try {
        if (await adapter.healthCheck()) {
          return true;
        }
      } catch {
        // Continue to next adapter
      }
    }
    return false;
  }

  /**
   * Get status of all adapters in the chain
   */
  getStatus(): Array<{
    id: string;
    provider: ModelProvider;
    circuitState: CircuitState;
  }> {
    return this.adaptersWithBreakers.map(({ adapter, breaker }) => ({
      id: adapter.id,
      provider: adapter.provider,
      circuitState: breaker.getState(),
    }));
  }

  /**
   * Get the first healthy adapter
   */
  async getHealthyAdapter(): Promise<ModelAdapter | undefined> {
    for (const { adapter, breaker } of this.adaptersWithBreakers) {
      if (breaker.getState() !== CircuitState.OPEN) {
        try {
          if (await adapter.healthCheck()) {
            return adapter;
          }
        } catch {
          // Continue to next
        }
      }
    }
    return undefined;
  }
}

/**
 * Create a fallback adapter from a list of adapter configs
 */
export function createFallbackAdapter(
  adapters: ModelAdapter[],
  options?: FallbackConfig['circuitBreakerOptions']
): FallbackAdapter {
  return new FallbackAdapter({
    adapters,
    circuitBreakerOptions: options,
  });
}
