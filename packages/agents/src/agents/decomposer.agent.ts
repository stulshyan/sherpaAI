// Decomposer agent for breaking requirements into features
// Enhanced for S-036 with chunking and multi-pass decomposition

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
import { AgentType as AgentTypeEnum, createLogger } from '@entropy/shared';
import { BaseAgent } from '../base-agent.js';
import { OUTPUT_SCHEMAS } from '../validator.js';

const decomposerLogger = createLogger('decomposer-agent');

// Token estimation: ~4 chars per token for English text
const CHARS_PER_TOKEN = 4;
const MAX_TOKENS_PER_CHUNK = 40000; // Leave room for prompt and output
const MAX_CHARS_PER_CHUNK = MAX_TOKENS_PER_CHUNK * CHARS_PER_TOKEN;
const OVERLAP_CHARS = 2000; // Overlap between chunks for context

export interface DecomposerInput {
  requirementId: string;
  requirementText: string;
  requirementType: RequirementType;
  chunkIndex?: number;
  totalChunks?: number;
  previousThemes?: string[]; // For context in multi-pass
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

export interface ChunkInfo {
  text: string;
  startOffset: number;
  endOffset: number;
  index: number;
  total: number;
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

    // Build chunk context section if processing multiple chunks
    const chunkContext =
      data.chunkIndex !== undefined && data.totalChunks !== undefined
        ? this.buildChunkContext(data.chunkIndex, data.totalChunks, data.previousThemes)
        : '';

    return this.promptEngine.render(ENHANCED_DECOMPOSER_TEMPLATE, {
      requirement: data.requirementText,
      requirementType: data.requirementType,
      chunkContext,
    });
  }

  async parseOutput(response: string): Promise<Record<string, unknown>> {
    const json = this.extractJSON(response);
    return JSON.parse(json);
  }

  /**
   * Build context section for chunked processing
   */
  private buildChunkContext(
    chunkIndex: number,
    totalChunks: number,
    previousThemes?: string[]
  ): string {
    const lines = [`## Processing Context`, `This is chunk ${chunkIndex + 1} of ${totalChunks}.`];

    if (previousThemes && previousThemes.length > 0) {
      lines.push('', 'Previously identified themes from earlier chunks:');
      previousThemes.forEach((theme) => lines.push(`- ${theme}`));
      lines.push('', 'Consider these themes when identifying new themes to ensure consistency.');
    }

    return lines.join('\n');
  }

  /**
   * Estimate token count for text
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  /**
   * Check if text requires chunking
   */
  requiresChunking(text: string): boolean {
    return this.estimateTokens(text) > MAX_TOKENS_PER_CHUNK;
  }

  /**
   * Split text into chunks with overlap
   */
  createChunks(text: string): ChunkInfo[] {
    if (!this.requiresChunking(text)) {
      return [
        {
          text,
          startOffset: 0,
          endOffset: text.length,
          index: 0,
          total: 1,
        },
      ];
    }

    const chunks: ChunkInfo[] = [];
    let offset = 0;

    while (offset < text.length) {
      // Find a good break point (prefer paragraph/sentence boundaries)
      let endOffset = Math.min(offset + MAX_CHARS_PER_CHUNK, text.length);

      // Try to break at paragraph boundary
      if (endOffset < text.length) {
        const paragraphBreak = text.lastIndexOf('\n\n', endOffset);
        if (paragraphBreak > offset + MAX_CHARS_PER_CHUNK * 0.5) {
          endOffset = paragraphBreak + 2;
        } else {
          // Try sentence boundary
          const sentenceBreak = text.lastIndexOf('. ', endOffset);
          if (sentenceBreak > offset + MAX_CHARS_PER_CHUNK * 0.5) {
            endOffset = sentenceBreak + 2;
          }
        }
      }

      chunks.push({
        text: text.slice(offset, endOffset),
        startOffset: offset,
        endOffset,
        index: chunks.length,
        total: 0, // Will be updated after
      });

      // Move offset with overlap
      offset = Math.max(offset + 1, endOffset - OVERLAP_CHARS);
    }

    // Update total count in all chunks
    chunks.forEach((chunk) => (chunk.total = chunks.length));

    decomposerLogger.info('Created chunks for large document', {
      totalChunks: chunks.length,
      originalLength: text.length,
      estimatedTokens: this.estimateTokens(text),
    });

    return chunks;
  }

  /**
   * Decompose a requirement into features (with automatic chunking for large documents)
   */
  async decompose(
    requirementId: string,
    requirementText: string,
    requirementType: RequirementType
  ): Promise<DecompositionResult> {
    const startTime = Date.now();

    // Check if chunking is needed
    const chunks = this.createChunks(requirementText);

    if (chunks.length === 1) {
      // Single chunk - standard processing
      return this.decomposeChunk(requirementId, requirementText, requirementType, startTime);
    }

    // Multi-chunk processing
    decomposerLogger.info('Starting multi-pass decomposition', {
      requirementId,
      chunks: chunks.length,
    });

    const chunkResults: DecomposerRawOutput[] = [];
    const previousThemes: string[] = [];

    for (const chunk of chunks) {
      decomposerLogger.debug('Processing chunk', {
        requirementId,
        chunk: chunk.index + 1,
        total: chunk.total,
      });

      const output = await this.execute({
        type: AgentTypeEnum.DECOMPOSER,
        data: {
          requirementId,
          requirementText: chunk.text,
          requirementType,
          chunkIndex: chunk.index,
          totalChunks: chunk.total,
          previousThemes,
        },
      });

      const data = output.data as unknown as DecomposerRawOutput;
      chunkResults.push(data);

      // Collect themes for next chunk context
      data.themes.forEach((t) => {
        if (!previousThemes.includes(t.name)) {
          previousThemes.push(t.name);
        }
      });
    }

    // Merge results from all chunks
    return this.mergeChunkResults(requirementId, chunkResults, startTime);
  }

  /**
   * Decompose a single chunk
   */
  private async decomposeChunk(
    requirementId: string,
    requirementText: string,
    requirementType: RequirementType,
    startTime: number
  ): Promise<DecompositionResult> {
    const output = await this.execute({
      type: AgentTypeEnum.DECOMPOSER,
      data: {
        requirementId,
        requirementText,
        requirementType,
      },
    });

    const data = output.data as unknown as DecomposerRawOutput;
    return this.transformOutput(requirementId, data, startTime, output.model);
  }

  /**
   * Merge results from multiple chunks
   */
  private mergeChunkResults(
    requirementId: string,
    results: DecomposerRawOutput[],
    startTime: number
  ): DecompositionResult {
    // Deduplicate themes by name
    const themeMap = new Map<
      string,
      { id: string; name: string; description: string; confidence: number }
    >();
    for (const result of results) {
      for (const theme of result.themes) {
        const existing = themeMap.get(theme.name.toLowerCase());
        if (!existing || theme.confidence > existing.confidence) {
          themeMap.set(theme.name.toLowerCase(), theme);
        }
      }
    }

    // Collect all atomic requirements with unique IDs
    const atomicRequirements: AtomicRequirement[] = [];
    const arIdMap = new Map<string, string>(); // old ID -> new ID

    for (const result of results) {
      for (const ar of result.atomicRequirements) {
        // Check for duplicates by comparing text similarity
        const isDuplicate = atomicRequirements.some(
          (existing) => this.textSimilarity(existing.text, ar.text) > 0.9
        );

        if (!isDuplicate) {
          const newId = randomUUID();
          arIdMap.set(ar.id, newId);
          atomicRequirements.push({
            id: newId,
            featureId: '',
            text: ar.text,
            clarityScore: ar.clarityScore,
            theme: ar.theme,
            dependencies: ar.dependencies || [],
            order: atomicRequirements.length,
          });
        }
      }
    }

    // Collect and deduplicate feature candidates
    const featureMap = new Map<string, FeatureCandidate>();
    for (const result of results) {
      for (const fc of result.featureCandidates) {
        const key = fc.title.toLowerCase();
        const existing = featureMap.get(key);

        if (!existing) {
          // Map old AR IDs to new IDs
          const mappedArIds = fc.atomicRequirementIds
            .map((id) => arIdMap.get(id) || id)
            .filter((id) => atomicRequirements.some((ar) => ar.id === id));

          featureMap.set(key, {
            title: fc.title,
            description: fc.description,
            theme: fc.theme,
            atomicRequirementIds: mappedArIds,
            estimatedComplexity: fc.estimatedComplexity || 'medium',
            suggestedPriority: fc.suggestedPriority || 5,
          });
        } else {
          // Merge atomic requirement IDs
          const newIds = fc.atomicRequirementIds
            .map((id) => arIdMap.get(id) || id)
            .filter((id) => atomicRequirements.some((ar) => ar.id === id));

          existing.atomicRequirementIds = [
            ...new Set([...existing.atomicRequirementIds, ...newIds]),
          ];
        }
      }
    }

    // Collect and deduplicate questions
    const questionSet = new Set<string>();
    const clarificationQuestions: ClarificationQuestion[] = [];

    for (const result of results) {
      for (const q of result.clarificationQuestions || []) {
        const key = q.question.toLowerCase().trim();
        if (!questionSet.has(key)) {
          questionSet.add(key);
          clarificationQuestions.push({
            id: randomUUID(),
            featureId: '',
            question: q.question,
            questionType: q.questionType,
            options: q.options,
            priority: q.priority,
          });
        }
      }
    }

    // Build themes array with AR IDs
    const themes: Theme[] = Array.from(themeMap.values()).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      confidence: t.confidence,
      atomicRequirementIds: atomicRequirements.filter((ar) => ar.theme === t.id).map((ar) => ar.id),
    }));

    decomposerLogger.info('Merged multi-chunk results', {
      requirementId,
      themes: themes.length,
      atomicRequirements: atomicRequirements.length,
      featureCandidates: featureMap.size,
      clarificationQuestions: clarificationQuestions.length,
    });

    return {
      requirementId,
      themes,
      atomicRequirements,
      featureCandidates: Array.from(featureMap.values()),
      clarificationQuestions,
      processingTimeMs: Date.now() - startTime,
      model: 'multi-pass',
    };
  }

  /**
   * Calculate text similarity (Jaccard index)
   */
  private textSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Transform raw output to typed result
   */
  private transformOutput(
    requirementId: string,
    data: DecomposerRawOutput,
    startTime: number,
    model: string
  ): DecompositionResult {
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
      featureId: '',
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
        featureId: '',
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
      model,
    };
  }
}

// Enhanced decomposer prompt template
const ENHANCED_DECOMPOSER_TEMPLATE = `You are an expert requirements decomposer with deep experience in software architecture and product management. Break down the following requirement into themes, atomic requirements, and feature candidates.

## Requirement
{{requirement}}

## Requirement Type
{{requirementType}}

{{chunkContext}}

## Decomposition Instructions

### 1. Identify Themes
Extract 2-5 high-level themes that capture the major functional areas. Each theme should be:
- Cohesive and represent a distinct capability
- Named with a clear, descriptive title
- Scored for confidence (how clearly defined in the requirement)

### 2. Extract Atomic Requirements
Break down into the smallest testable units. Each atomic requirement should:
- Be independently verifiable
- Have a single, clear behavior or outcome
- Include a clarity score (how unambiguous the requirement is)
- Be assigned to a theme

### 3. Group into Feature Candidates
Combine related atomic requirements into feature candidates:
- Each feature should be deliverable independently
- Estimate complexity (low/medium/high)
- Suggest priority (1-10, where 1 is highest)

### 4. Generate Clarification Questions
For ambiguous or incomplete areas, generate questions:
- Use appropriate question types (multiple_choice, yes_no, text, dropdown)
- Assign priority (blocking, important, nice_to_have)
- Provide options for multiple_choice and dropdown types

## Response Format
Respond with a JSON object:
{
  "themes": [
    {
      "id": "theme-1",
      "name": "Theme name",
      "description": "Theme description",
      "confidence": 0.0-1.0
    }
  ],
  "atomicRequirements": [
    {
      "id": "ar-1",
      "text": "Clear, specific requirement statement",
      "clarityScore": 0.0-1.0,
      "theme": "theme-1",
      "dependencies": ["ar-2"]
    }
  ],
  "featureCandidates": [
    {
      "title": "Feature title",
      "description": "Feature description with acceptance criteria",
      "theme": "theme-1",
      "atomicRequirementIds": ["ar-1", "ar-2"],
      "estimatedComplexity": "low" | "medium" | "high",
      "suggestedPriority": 1-10
    }
  ],
  "clarificationQuestions": [
    {
      "question": "Question about ambiguous requirement",
      "questionType": "multiple_choice" | "yes_no" | "text" | "dropdown",
      "options": ["Option 1", "Option 2"],
      "priority": "blocking" | "important" | "nice_to_have"
    }
  ]
}`;

/**
 * Create a decomposer agent with default configuration
 */
export function createDecomposerAgent(modelId?: string): DecomposerAgent {
  return new DecomposerAgent(modelId ? { modelId } : undefined);
}
