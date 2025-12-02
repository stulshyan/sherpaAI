// Model adapter interface and types (F-001)

export type ModelProvider = 'anthropic' | 'openai' | 'google';

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: unknown[];
  description?: string;
  [key: string]: unknown;
}

export interface CompletionRequest {
  messages: Message[];
  model: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  responseFormat?: 'text' | 'json';
  tools?: ToolDefinition[];
  stopSequences?: string[];
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CompletionResponse {
  content: string;
  usage: TokenUsage;
  model: string;
  latencyMs: number;
  finishReason: 'stop' | 'length' | 'tool_use' | 'error';
  toolCalls?: ToolCall[];
  requestId: string;
}

export interface StreamChunk {
  type: 'content' | 'tool_call' | 'done' | 'error';
  content?: string;
  toolCall?: Partial<ToolCall>;
  error?: string;
  usage?: TokenUsage;
}

export interface ModelAdapter {
  id: string;
  provider: ModelProvider;

  complete(request: CompletionRequest): Promise<CompletionResponse>;
  stream(request: CompletionRequest): AsyncIterable<StreamChunk>;

  countTokens(text: string): number;
  estimateCost(tokens: TokenUsage): number;

  healthCheck(): Promise<boolean>;
}

export interface AdapterConfig {
  id: string;
  provider: ModelProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxRetries?: number;
  timeoutMs?: number;
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

// Custom error types for adapter layer
export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

export class RateLimitError extends AdapterError {
  constructor(
    message: string,
    public readonly retryAfterMs?: number
  ) {
    super(message, 'RATE_LIMIT', true, 429);
    this.name = 'RateLimitError';
  }
}

export class AuthError extends AdapterError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR', false, 401);
    this.name = 'AuthError';
  }
}

export class TimeoutError extends AdapterError {
  constructor(message: string) {
    super(message, 'TIMEOUT', true, 408);
    this.name = 'TimeoutError';
  }
}

export class ModelNotFoundError extends AdapterError {
  constructor(model: string) {
    super(`Model not found: ${model}`, 'MODEL_NOT_FOUND', false, 404);
    this.name = 'ModelNotFoundError';
  }
}
