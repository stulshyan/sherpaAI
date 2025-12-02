// Base adapter implementation

import type {
  ModelAdapter,
  AdapterConfig,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  TokenUsage,
  ModelProvider,
} from '@entropy/shared';
import { withRetry, withTimeout, createLogger } from '@entropy/shared';

export abstract class BaseAdapter implements ModelAdapter {
  readonly id: string;
  readonly provider: ModelProvider;
  protected logger;

  constructor(protected config: AdapterConfig) {
    this.id = config.id;
    this.provider = config.provider;
    this.logger = createLogger(`adapter:${config.provider}`);
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const timeoutMs = this.config.timeoutMs || 60000;

    return withRetry(
      () => withTimeout(this.doComplete(request), timeoutMs),
      {
        maxAttempts: this.config.maxRetries || 3,
        baseDelayMs: 1000,
        shouldRetry: (error) => this.isRetryableError(error),
        onRetry: (error, attempt, delay) => {
          this.logger.warn('Retrying request', {
            error: error.message,
            attempt,
            delay,
          });
        },
      }
    );
  }

  abstract stream(request: CompletionRequest): AsyncIterable<StreamChunk>;
  abstract countTokens(text: string): number;
  abstract estimateCost(tokens: TokenUsage): number;
  abstract healthCheck(): Promise<boolean>;

  protected abstract doComplete(
    request: CompletionRequest
  ): Promise<CompletionResponse>;

  protected isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('rate limit') ||
      message.includes('timeout') ||
      message.includes('503') ||
      message.includes('529')
    );
  }
}
