// Agent framework types (F-002)

import type { JSONSchema, TokenUsage } from './adapter.js';
import type { UUID, Status } from './common.js';

export enum AgentType {
  DECOMPOSER = 'decomposer',
  CLASSIFIER = 'classifier',
  IMPACT_ANALYZER = 'impact_analyzer',
  SPEC_GENERATOR = 'spec_generator',
  CODE_GENERATOR = 'code_generator',
}

export interface AgentConfig {
  id: string;
  type: AgentType;
  modelId: string;
  fallbackModelIds: string[];
  maxRetries: number;
  timeoutMs: number;
  promptTemplateKey: string;
  outputSchema?: JSONSchema;
  temperature?: number;
  maxTokens?: number;
}

export interface ExecutionContext {
  executionId: UUID;
  agentId: string;
  agentType: AgentType;
  projectId?: UUID;
  featureId?: UUID;
  requirementId?: UUID;
  metadata: Record<string, unknown>;
  startedAt: Date;
}

export interface AgentInput {
  type: AgentType;
  data: Record<string, unknown>;
  context?: ExecutionContext;
}

export interface AgentOutput {
  type: AgentType;
  data: Record<string, unknown>;
  quality: QualityScore;
  usage: TokenUsage;
  model: string;
  latencyMs: number;
}

export interface QualityScore {
  overall: number; // 0-1
  completeness: number;
  consistency: number;
  confidence: number;
}

export interface Agent {
  id: string;
  type: AgentType;
  config: AgentConfig;

  execute(input: AgentInput): Promise<AgentOutput>;

  // Lifecycle hooks
  onBeforeExecute?(context: ExecutionContext): Promise<void>;
  onAfterExecute?(result: AgentOutput): Promise<void>;
  onError?(error: Error): Promise<void>;
}

export interface AgentExecution {
  id: UUID;
  agentId: string;
  agentType: AgentType;
  featureId?: UUID;
  requirementId?: UUID;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  status: Status;
  errorMessage?: string;
  createdAt: Date;
}

// Plugin interfaces for extensibility
export interface PreProcessor {
  name: string;
  priority: number;
  process(input: AgentInput): Promise<AgentInput>;
}

export interface PostProcessor {
  name: string;
  priority: number;
  process(output: AgentOutput): Promise<AgentOutput>;
}

export interface AgentPlugin {
  name: string;
  preProcessors?: PreProcessor[];
  postProcessors?: PostProcessor[];
}
