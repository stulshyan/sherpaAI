// Classifier agent for requirement type classification

import type {
  AgentConfig,
  AgentInput,
  ClassificationResult,
} from '@entropy/shared';
import { AgentType as AgentTypeEnum } from '@entropy/shared';
import { BaseAgent } from '../base-agent.js';
import { DEFAULT_TEMPLATES } from '../prompt-engine.js';
import { OUTPUT_SCHEMAS } from '../validator.js';

export interface ClassifierInput {
  requirementId: string;
  requirementText: string;
}

export interface ClassifierOutput {
  type: 'new_feature' | 'enhancement' | 'epic' | 'bug_fix';
  confidence: number;
  reasoning: string;
  suggestedDecomposition: boolean;
}

export class ClassifierAgent extends BaseAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      id: 'classifier-agent',
      type: AgentTypeEnum.CLASSIFIER,
      modelId: config?.modelId || 'claude-sonnet-4-5-20250929',
      fallbackModelIds: config?.fallbackModelIds || ['gpt-4o'],
      maxRetries: config?.maxRetries || 3,
      timeoutMs: config?.timeoutMs || 30000,
      promptTemplateKey: 'agents/classifier/v1.0.0/system',
      outputSchema: OUTPUT_SCHEMAS.classification,
      temperature: config?.temperature || 0.3,
      maxTokens: config?.maxTokens || 1024,
      ...config,
    });
  }

  async buildPrompt(input: AgentInput): Promise<string> {
    const data = input.data as unknown as ClassifierInput;

    return this.promptEngine.render(DEFAULT_TEMPLATES.classifier, {
      requirement: data.requirementText,
    });
  }

  async parseOutput(response: string): Promise<Record<string, unknown>> {
    const json = this.extractJSON(response);
    return JSON.parse(json);
  }

  /**
   * Classify a requirement and return typed result
   */
  async classify(
    requirementId: string,
    requirementText: string
  ): Promise<ClassificationResult> {
    const output = await this.execute({
      type: AgentTypeEnum.CLASSIFIER,
      data: {
        requirementId,
        requirementText,
      },
    });

    const data = output.data as unknown as ClassifierOutput;

    return {
      requirementId,
      type: data.type,
      confidence: data.confidence,
      reasoning: data.reasoning,
      suggestedDecomposition: data.suggestedDecomposition,
    };
  }
}

/**
 * Create a classifier agent with default configuration
 */
export function createClassifierAgent(
  modelId?: string
): ClassifierAgent {
  return new ClassifierAgent({ modelId });
}
