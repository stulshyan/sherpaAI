// Classifier agent for requirement type classification
// Enhanced for S-035 with structure awareness and confidence indicators

import type { AgentConfig, AgentInput, ClassificationResult } from '@entropy/shared';
import { AgentType as AgentTypeEnum } from '@entropy/shared';
import { BaseAgent } from '../base-agent.js';
import { OUTPUT_SCHEMAS } from '../validator.js';

export interface ClassifierInput {
  requirementId: string;
  requirementText: string;
  documentMetadata?: DocumentMetadata;
}

export interface DocumentMetadata {
  wordCount?: number;
  pageCount?: number;
  detectedLanguage?: string;
  hasHeadings?: boolean;
  headingCount?: number;
  hasBulletLists?: boolean;
  hasNumberedLists?: boolean;
  hasTables?: boolean;
}

export interface ClassifierOutput {
  type: 'new_feature' | 'enhancement' | 'epic' | 'bug_fix';
  confidence: number;
  reasoning: string;
  suggestedDecomposition: boolean;
  indicators: ClassificationIndicators;
}

export interface ClassificationIndicators {
  hasMultipleThemes: boolean;
  estimatedComplexity: 'low' | 'medium' | 'high';
  scopeIndicators: string[];
  ambiguityFlags: string[];
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

    // Build enhanced prompt with document metadata if available
    const metadataSection = data.documentMetadata
      ? this.buildMetadataSection(data.documentMetadata)
      : '';

    return this.promptEngine.render(ENHANCED_CLASSIFIER_TEMPLATE, {
      requirement: data.requirementText,
      metadataSection,
    });
  }

  async parseOutput(response: string): Promise<Record<string, unknown>> {
    const json = this.extractJSON(response);
    const parsed = JSON.parse(json);

    // Ensure indicators are present with defaults
    if (!parsed.indicators) {
      parsed.indicators = {
        hasMultipleThemes: false,
        estimatedComplexity: 'medium',
        scopeIndicators: [],
        ambiguityFlags: [],
      };
    }

    return parsed;
  }

  /**
   * Build metadata section for the prompt
   */
  private buildMetadataSection(metadata: DocumentMetadata): string {
    const lines: string[] = ['## Document Metadata'];

    if (metadata.wordCount !== undefined) {
      lines.push(`- Word count: ${metadata.wordCount}`);
    }
    if (metadata.pageCount !== undefined) {
      lines.push(`- Page count: ${metadata.pageCount}`);
    }
    if (metadata.detectedLanguage) {
      lines.push(`- Detected language: ${metadata.detectedLanguage}`);
    }
    if (metadata.hasHeadings) {
      lines.push(`- Has headings: ${metadata.headingCount || 'yes'}`);
    }
    if (metadata.hasBulletLists || metadata.hasNumberedLists) {
      lines.push(`- Has structured lists: yes`);
    }
    if (metadata.hasTables) {
      lines.push(`- Has tables: yes`);
    }

    return lines.join('\n');
  }

  /**
   * Classify a requirement and return typed result
   */
  async classify(
    requirementId: string,
    requirementText: string,
    documentMetadata?: DocumentMetadata
  ): Promise<ClassificationResult> {
    const output = await this.execute({
      type: AgentTypeEnum.CLASSIFIER,
      data: {
        requirementId,
        requirementText,
        documentMetadata,
      },
    });

    const data = output.data as unknown as ClassifierOutput;

    return {
      requirementId,
      type: data.type,
      confidence: data.confidence,
      reasoning: data.reasoning,
      suggestedDecomposition: data.suggestedDecomposition,
      indicators: data.indicators,
    };
  }

  /**
   * Pre-analyze text to suggest if classification is worthwhile
   */
  preAnalyze(text: string): PreAnalysisResult {
    const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
    const hasMultipleSections = (text.match(/#+\s|^\d+\.\s/gm)?.length || 0) > 3;
    const hasTechnicalTerms =
      /\b(API|database|integration|authentication|authorization|component|module|service)\b/i.test(
        text
      );
    const hasActionVerbs =
      /\b(shall|must|should|will|can|may|implement|create|add|update|delete|display)\b/i.test(text);

    // Estimate complexity based on indicators
    let complexityScore = 0;
    if (wordCount > 500) complexityScore++;
    if (wordCount > 2000) complexityScore++;
    if (hasMultipleSections) complexityScore++;
    if (hasTechnicalTerms) complexityScore++;

    const estimatedComplexity: 'low' | 'medium' | 'high' =
      complexityScore <= 1 ? 'low' : complexityScore <= 2 ? 'medium' : 'high';

    return {
      wordCount,
      hasMultipleSections,
      hasTechnicalTerms,
      hasActionVerbs,
      estimatedComplexity,
      shouldClassify: hasActionVerbs || hasTechnicalTerms || wordCount > 100,
    };
  }
}

export interface PreAnalysisResult {
  wordCount: number;
  hasMultipleSections: boolean;
  hasTechnicalTerms: boolean;
  hasActionVerbs: boolean;
  estimatedComplexity: 'low' | 'medium' | 'high';
  shouldClassify: boolean;
}

// Enhanced classifier prompt template
const ENHANCED_CLASSIFIER_TEMPLATE = `You are an expert requirements analyst with deep experience in software development lifecycle. Analyze the following requirement and classify it accurately.

## Requirement
{{requirement}}

{{metadataSection}}

## Classification Instructions
Classify this requirement into one of the following types:
- **new_feature**: A completely new capability or feature that doesn't exist in the current system
- **enhancement**: An improvement, modification, or extension to an existing feature
- **epic**: A large requirement that spans multiple features or user stories (typically 2+ weeks of work)
- **bug_fix**: A defect correction, bug fix, or issue resolution

## Analysis Guidelines
1. Look for scope indicators (multiple themes suggest epic)
2. Check for references to existing functionality (suggests enhancement)
3. Identify ambiguities that may need clarification
4. Estimate complexity based on technical requirements

## Response Format
Respond with a JSON object:
{
  "type": "new_feature" | "enhancement" | "epic" | "bug_fix",
  "confidence": 0.0-1.0,
  "reasoning": "Detailed explanation of your classification decision",
  "suggestedDecomposition": true | false,
  "indicators": {
    "hasMultipleThemes": true | false,
    "estimatedComplexity": "low" | "medium" | "high",
    "scopeIndicators": ["indicator1", "indicator2"],
    "ambiguityFlags": ["ambiguity1", "ambiguity2"]
  }
}`;

/**
 * Create a classifier agent with default configuration
 */
export function createClassifierAgent(modelId?: string): ClassifierAgent {
  return new ClassifierAgent(modelId ? { modelId } : undefined);
}
