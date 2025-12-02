// Base agent class that all agents extend

import { randomUUID } from 'crypto';
import { getAdapterRegistry } from '@entropy/adapters';
import type {
  Agent,
  AgentConfig,
  AgentInput,
  AgentOutput,
  AgentType,
  ExecutionContext,
  ModelAdapter,
  CompletionRequest,
  CompletionResponse,
} from '@entropy/shared';
import { createLogger, withRetry, withTimeout } from '@entropy/shared';
import { PromptEngine } from './prompt-engine.js';
import { QualityScorer } from './quality.js';
import { OutputValidator } from './validator.js';

export abstract class BaseAgent implements Agent {
  readonly id: string;
  readonly type: AgentType;
  readonly config: AgentConfig;

  protected adapter: ModelAdapter;
  protected promptEngine: PromptEngine;
  protected validator: OutputValidator;
  protected qualityScorer: QualityScorer;
  protected logger;

  constructor(config: AgentConfig) {
    this.id = config.id;
    this.type = config.type;
    this.config = config;

    this.adapter = getAdapterRegistry().get(config.modelId);
    this.promptEngine = new PromptEngine();
    this.validator = new OutputValidator();
    this.qualityScorer = new QualityScorer();
    this.logger = createLogger(`agent:${config.type}`);
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const context = this.createContext(input);

    try {
      // Lifecycle hook: before execute
      await this.onBeforeExecute?.(context);

      // Build prompt from template
      const prompt = await this.buildPrompt(input);

      // Execute with retry and timeout
      const response = await this.executeWithRetry(prompt);

      // Parse the response
      const parsedOutput = await this.parseOutput(response.content);

      // Validate output against schema
      if (this.config.outputSchema) {
        await this.validator.validate(parsedOutput, this.config.outputSchema);
      }

      // Calculate quality score
      const quality = this.qualityScorer.score(
        parsedOutput,
        this.config.outputSchema
      );

      const output: AgentOutput = {
        type: this.type,
        data: parsedOutput,
        quality,
        usage: response.usage,
        model: response.model,
        latencyMs: response.latencyMs,
      };

      // Lifecycle hook: after execute
      await this.onAfterExecute?.(output);

      // Log execution
      await this.logExecution(input, output, context);

      return output;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await this.onError?.(err);
      throw err;
    }
  }

  // Abstract methods that concrete agents must implement
  abstract buildPrompt(input: AgentInput): Promise<string>;
  abstract parseOutput(response: string): Promise<Record<string, unknown>>;

  // Optional lifecycle hooks
  onBeforeExecute?(context: ExecutionContext): Promise<void>;
  onAfterExecute?(result: AgentOutput): Promise<void>;
  onError?(error: Error): Promise<void>;

  protected async executeWithRetry(
    prompt: string
  ): Promise<CompletionResponse> {
    const request: CompletionRequest = {
      messages: [{ role: 'user', content: prompt }],
      model: this.config.modelId,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
      responseFormat: this.config.outputSchema ? 'json' : 'text',
    };

    return withRetry(
      () =>
        withTimeout(
          this.adapter.complete(request),
          this.config.timeoutMs,
          `Agent ${this.id} timed out`
        ),
      {
        maxAttempts: this.config.maxRetries,
        baseDelayMs: 1000,
        onRetry: (error, attempt, delay) => {
          this.logger.warn('Retrying agent execution', {
            agentId: this.id,
            attempt,
            delay,
            error: error.message,
          });
        },
      }
    );
  }

  protected createContext(input: AgentInput): ExecutionContext {
    return {
      executionId: randomUUID(),
      agentId: this.id,
      agentType: this.type,
      projectId: input.context?.projectId,
      featureId: input.context?.featureId,
      requirementId: input.context?.requirementId,
      metadata: input.context?.metadata || {},
      startedAt: new Date(),
    };
  }

  protected async logExecution(
    _input: AgentInput,
    output: AgentOutput,
    context: ExecutionContext
  ): Promise<void> {
    this.logger.info('Agent execution completed', {
      executionId: context.executionId,
      agentId: this.id,
      agentType: this.type,
      model: output.model,
      inputTokens: output.usage.inputTokens,
      outputTokens: output.usage.outputTokens,
      latencyMs: output.latencyMs,
      qualityScore: output.quality.overall,
    });

    // TODO: Persist to database
  }

  /**
   * Extract JSON from response that may contain markdown code blocks
   */
  protected extractJSON(content: string): string {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return jsonMatch[1]!.trim();
    }

    // Try to find raw JSON object or array
    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return objectMatch[0];
    }

    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return arrayMatch[0];
    }

    // Return as-is if no JSON found
    return content.trim();
  }
}
