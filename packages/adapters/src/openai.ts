// OpenAI adapter implementation

import type {
  AdapterConfig,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  TokenUsage,
  ToolDefinition,
} from '@entropy/shared';
import { RateLimitError, AuthError, TimeoutError } from '@entropy/shared';
import OpenAI from 'openai';
import { BaseAdapter } from './base.js';

// Pricing per 1M tokens (as of Dec 2024)
const OPENAI_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-4': { input: 30.0, output: 60.0 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
};

export class OpenAIAdapter extends BaseAdapter {
  private client: OpenAI;

  constructor(config: AdapterConfig) {
    super({ ...config, provider: 'openai' });
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      baseURL: config.baseUrl,
    });
  }

  protected async doComplete(request: CompletionRequest): Promise<CompletionResponse> {
    const startTime = Date.now();

    try {
      const messages = this.convertMessages(request);
      const tools = request.tools ? this.convertTools(request.tools) : undefined;

      const response = await this.client.chat.completions.create({
        model: request.model,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        messages,
        tools,
        response_format: request.responseFormat === 'json' ? { type: 'json_object' } : undefined,
        stop: request.stopSequences,
      });

      const latencyMs = Date.now() - startTime;
      const choice = response.choices[0];

      const toolCalls = choice?.message.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));

      return {
        content: choice?.message.content || '',
        usage: {
          inputTokens: response.usage?.prompt_tokens || 0,
          outputTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        model: response.model,
        latencyMs,
        finishReason: this.mapFinishReason(choice?.finish_reason),
        toolCalls,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    try {
      const messages = this.convertMessages(request);

      const stream = await this.client.chat.completions.create({
        model: request.model,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        messages,
        stream: true,
      });

      let totalContent = '';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          totalContent += delta.content;
          yield {
            type: 'content',
            content: delta.content,
          };
        }
      }

      // OpenAI streams don't provide usage, so we estimate
      yield {
        type: 'done',
        usage: {
          inputTokens: this.countTokens(messages.map((m) => m.content).join('')),
          outputTokens: this.countTokens(totalContent),
          totalTokens: 0, // Will be calculated
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
    // Approximate token count using GPT-4 tokenizer estimation
    // ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  estimateCost(tokens: TokenUsage): number {
    const pricing = OPENAI_PRICING[this.config.model] || {
      input: 2.5,
      output: 10.0,
    };
    return (
      (tokens.inputTokens * pricing.input) / 1_000_000 +
      (tokens.outputTokens * pricing.output) / 1_000_000
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: this.config.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return true;
    } catch {
      return false;
    }
  }

  private convertMessages(request: CompletionRequest): OpenAI.ChatCompletionMessageParam[] {
    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        messages.push({ role: 'system', content: msg.content });
      } else if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content });
      } else if (msg.role === 'tool' && msg.toolCallId) {
        messages.push({
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.toolCallId,
        });
      }
    }

    return messages;
  }

  private convertTools(tools: ToolDefinition[]): OpenAI.ChatCompletionTool[] {
    return tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  private mapFinishReason(reason?: string | null): 'stop' | 'length' | 'tool_use' | 'error' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool_calls':
        return 'tool_use';
      default:
        return 'stop';
    }
  }

  private handleError(error: unknown): Error {
    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        return new RateLimitError(error.message);
      }
      if (error.status === 401) {
        return new AuthError(error.message);
      }
      if (error.message.includes('timeout')) {
        return new TimeoutError(error.message);
      }
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
