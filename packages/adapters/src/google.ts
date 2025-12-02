// Google Gemini adapter implementation

import type {
  AdapterConfig,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  TokenUsage,
  Message,
} from '@entropy/shared';
import { RateLimitError, AuthError, TimeoutError } from '@entropy/shared';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseAdapter } from './base.js';

// Pricing per 1M tokens (as of Dec 2024)
const GOOGLE_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gemini-1.0-pro': { input: 0.5, output: 1.5 },
};

export class GoogleAdapter extends BaseAdapter {
  private client: GoogleGenerativeAI;

  constructor(config: AdapterConfig) {
    super({ ...config, provider: 'google' });
    this.client = new GoogleGenerativeAI(config.apiKey || process.env.GOOGLE_API_KEY || '');
  }

  protected async doComplete(request: CompletionRequest): Promise<CompletionResponse> {
    const startTime = Date.now();

    try {
      const model = this.client.getGenerativeModel({
        model: request.model,
        generationConfig: {
          maxOutputTokens: request.maxTokens,
          temperature: request.temperature,
        },
        systemInstruction: request.systemPrompt,
      });

      const contents = this.convertMessages(request.messages);
      const result = await model.generateContent({ contents });

      const latencyMs = Date.now() - startTime;
      const response = result.response;
      const text = response.text();

      // Gemini provides usage metadata
      const usage = response.usageMetadata;

      return {
        content: text,
        usage: {
          inputTokens:
            usage?.promptTokenCount ||
            this.countTokens(request.messages.map((m) => m.content).join('')),
          outputTokens: usage?.candidatesTokenCount || this.countTokens(text),
          totalTokens: usage?.totalTokenCount || 0,
        },
        model: request.model,
        latencyMs,
        finishReason: this.mapFinishReason(response.candidates?.[0]?.finishReason),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    try {
      const model = this.client.getGenerativeModel({
        model: request.model,
        generationConfig: {
          maxOutputTokens: request.maxTokens,
          temperature: request.temperature,
        },
        systemInstruction: request.systemPrompt,
      });

      const contents = this.convertMessages(request.messages);
      const result = await model.generateContentStream({ contents });

      let totalContent = '';

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          totalContent += text;
          yield {
            type: 'content',
            content: text,
          };
        }
      }

      const response = await result.response;
      const usage = response.usageMetadata;

      yield {
        type: 'done',
        usage: {
          inputTokens: usage?.promptTokenCount || 0,
          outputTokens: usage?.candidatesTokenCount || this.countTokens(totalContent),
          totalTokens: usage?.totalTokenCount || 0,
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
    // Approximate token count for Gemini
    // Similar to other models, ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  estimateCost(tokens: TokenUsage): number {
    const pricing = GOOGLE_PRICING[this.config.model] || {
      input: 1.25,
      output: 5.0,
    };
    return (
      (tokens.inputTokens * pricing.input) / 1_000_000 +
      (tokens.outputTokens * pricing.output) / 1_000_000
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: this.config.model });
      await model.generateContent('ping');
      return true;
    } catch {
      return false;
    }
  }

  private convertMessages(
    messages: Message[]
  ): Array<{ role: string; parts: Array<{ text: string }> }> {
    return messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
  }

  private mapFinishReason(reason?: string): 'stop' | 'length' | 'tool_use' | 'error' {
    switch (reason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
      case 'RECITATION':
      case 'OTHER':
        return 'error';
      default:
        return 'stop';
    }
  }

  private handleError(error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('429') || message.includes('rate limit')) {
      return new RateLimitError(message);
    }
    if (message.includes('401') || message.includes('API key')) {
      return new AuthError(message);
    }
    if (message.includes('timeout')) {
      return new TimeoutError(message);
    }

    return error instanceof Error ? error : new Error(message);
  }
}
