// Anthropic Claude adapter implementation

import Anthropic from '@anthropic-ai/sdk';
import type {
  AdapterConfig,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  TokenUsage,
  Message,
  ToolDefinition,
} from '@entropy/shared';
import { RateLimitError, AuthError, TimeoutError } from '@entropy/shared';
import { BaseAdapter } from './base.js';

// Pricing per 1M tokens (as of Dec 2024)
const ANTHROPIC_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
  'claude-opus-4-5-20251101': { input: 15.0, output: 75.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
};

export class AnthropicAdapter extends BaseAdapter {
  private client: Anthropic;

  constructor(config: AdapterConfig) {
    super({ ...config, provider: 'anthropic' });
    this.client = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
      baseURL: config.baseUrl,
    });
  }

  protected async doComplete(
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    const startTime = Date.now();

    try {
      const messages = this.convertMessages(request.messages);
      const tools = request.tools
        ? this.convertTools(request.tools)
        : undefined;

      const response = await this.client.messages.create({
        model: request.model,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature,
        system: request.systemPrompt,
        messages,
        tools,
      });

      const latencyMs = Date.now() - startTime;

      const content = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as { type: 'text'; text: string }).text)
        .join('');

      const toolCalls = response.content
        .filter((block) => block.type === 'tool_use')
        .map((block) => {
          const toolBlock = block as {
            type: 'tool_use';
            id: string;
            name: string;
            input: Record<string, unknown>;
          };
          return {
            id: toolBlock.id,
            name: toolBlock.name,
            arguments: toolBlock.input,
          };
        });

      return {
        content,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens:
            response.usage.input_tokens + response.usage.output_tokens,
        },
        model: response.model,
        latencyMs,
        finishReason: this.mapStopReason(response.stop_reason),
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    try {
      const messages = this.convertMessages(request.messages);

      const stream = await this.client.messages.stream({
        model: request.model,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature,
        system: request.systemPrompt,
        messages,
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield {
            type: 'content',
            content: event.delta.text,
          };
        }
      }

      const finalMessage = await stream.finalMessage();
      yield {
        type: 'done',
        usage: {
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
          totalTokens:
            finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
        },
      };
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  countTokens(text: string): number {
    // Approximate token count (Anthropic doesn't provide exact tokenizer publicly)
    // Using ~4 characters per token as rough estimate
    return Math.ceil(text.length / 4);
  }

  estimateCost(tokens: TokenUsage): number {
    const pricing = ANTHROPIC_PRICING[this.config.model] || {
      input: 3.0,
      output: 15.0,
    };
    return (
      (tokens.inputTokens * pricing.input) / 1_000_000 +
      (tokens.outputTokens * pricing.output) / 1_000_000
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simple health check with minimal tokens
      await this.client.messages.create({
        model: this.config.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return true;
    } catch {
      return false;
    }
  }

  private convertMessages(
    messages: Message[]
  ): Anthropic.MessageParam[] {
    return messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));
  }

  private convertTools(tools: ToolDefinition[]): Anthropic.Tool[] {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool.InputSchema,
    }));
  }

  private mapStopReason(
    reason: string | null
  ): 'stop' | 'length' | 'tool_use' | 'error' {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
        return 'tool_use';
      default:
        return 'stop';
    }
  }

  private handleError(error: unknown): Error {
    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        return new RateLimitError(error.message);
      }
      if (error.status === 401) {
        return new AuthError(error.message);
      }
      if (error.status === 408 || error.message.includes('timeout')) {
        return new TimeoutError(error.message);
      }
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
