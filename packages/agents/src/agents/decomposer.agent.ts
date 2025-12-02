// Decomposer agent for breaking requirements into features

import { randomUUID } from 'crypto';
import type {
  AgentConfig,
  AgentInput,
  DecompositionResult,
  Theme,
  AtomicRequirement,
  FeatureCandidate,
  ClarificationQuestion,
  RequirementType,
} from '@entropy/shared';
import { AgentType as AgentTypeEnum } from '@entropy/shared';
import { BaseAgent } from '../base-agent.js';
import { DEFAULT_TEMPLATES } from '../prompt-engine.js';
import { OUTPUT_SCHEMAS } from '../validator.js';

export interface DecomposerInput {
  requirementId: string;
  requirementText: string;
  requirementType: RequirementType;
}

export interface DecomposerRawOutput {
  themes: Array<{
    id: string;
    name: string;
    description: string;
    confidence: number;
  }>;
  atomicRequirements: Array<{
    id: string;
    text: string;
    clarityScore: number;
    theme?: string;
    dependencies?: string[];
  }>;
  featureCandidates: Array<{
    title: string;
    description: string;
    theme: string;
    atomicRequirementIds: string[];
    estimatedComplexity?: 'low' | 'medium' | 'high';
    suggestedPriority?: number;
  }>;
  clarificationQuestions?: Array<{
    question: string;
    questionType: 'multiple_choice' | 'yes_no' | 'text' | 'dropdown';
    options?: string[];
    priority: 'blocking' | 'important' | 'nice_to_have';
  }>;
}

export class DecomposerAgent extends BaseAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      id: 'decomposer-agent',
      type: AgentTypeEnum.DECOMPOSER,
      modelId: config?.modelId || 'claude-sonnet-4-5-20250929',
      fallbackModelIds: config?.fallbackModelIds || ['gpt-4o', 'gemini-1.5-pro'],
      maxRetries: config?.maxRetries || 3,
      timeoutMs: config?.timeoutMs || 120000, // 2 minutes for complex decomposition
      promptTemplateKey: 'agents/decomposer/v1.0.0/system',
      outputSchema: OUTPUT_SCHEMAS.decomposition,
      temperature: config?.temperature || 0.5,
      maxTokens: config?.maxTokens || 8192,
      ...config,
    });
  }

  async buildPrompt(input: AgentInput): Promise<string> {
    const data = input.data as unknown as DecomposerInput;

    return this.promptEngine.render(DEFAULT_TEMPLATES.decomposer, {
      requirement: data.requirementText,
      requirementType: data.requirementType,
    });
  }

  async parseOutput(response: string): Promise<Record<string, unknown>> {
    const json = this.extractJSON(response);
    return JSON.parse(json);
  }

  /**
   * Decompose a requirement into features
   */
  async decompose(
    requirementId: string,
    requirementText: string,
    requirementType: RequirementType
  ): Promise<DecompositionResult> {
    const startTime = Date.now();

    const output = await this.execute({
      type: AgentTypeEnum.DECOMPOSER,
      data: {
        requirementId,
        requirementText,
        requirementType,
      },
    });

    const data = output.data as unknown as DecomposerRawOutput;

    // Transform raw output to typed result
    const themes: Theme[] = data.themes.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      confidence: t.confidence,
      atomicRequirementIds: data.atomicRequirements
        .filter((ar) => ar.theme === t.id)
        .map((ar) => ar.id),
    }));

    const atomicRequirements: AtomicRequirement[] = data.atomicRequirements.map((ar, index) => ({
      id: ar.id || randomUUID(),
      featureId: '', // Will be set when features are created
      text: ar.text,
      clarityScore: ar.clarityScore,
      theme: ar.theme,
      dependencies: ar.dependencies || [],
      order: index,
    }));

    const featureCandidates: FeatureCandidate[] = data.featureCandidates.map((fc) => ({
      title: fc.title,
      description: fc.description,
      theme: fc.theme,
      atomicRequirementIds: fc.atomicRequirementIds,
      estimatedComplexity: fc.estimatedComplexity || 'medium',
      suggestedPriority: fc.suggestedPriority || 5,
    }));

    const clarificationQuestions: ClarificationQuestion[] = (data.clarificationQuestions || []).map(
      (q) => ({
        id: randomUUID(),
        featureId: '', // Will be set when features are created
        question: q.question,
        questionType: q.questionType,
        options: q.options,
        priority: q.priority,
      })
    );

    return {
      requirementId,
      themes,
      atomicRequirements,
      featureCandidates,
      clarificationQuestions,
      processingTimeMs: Date.now() - startTime,
      model: output.model,
    };
  }
}

/**
 * Create a decomposer agent with default configuration
 */
export function createDecomposerAgent(modelId?: string): DecomposerAgent {
  return new DecomposerAgent({ modelId });
}
