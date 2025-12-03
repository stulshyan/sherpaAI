// Decomposition Orchestrator for S-039
// Coordinates the full decomposition pipeline: Extract → Classify → Decompose → Score → Store

import { randomUUID } from 'crypto';
import { createClassifierAgent, createDecomposerAgent } from '@entropy/agents';
import {
  createLogger,
  createReadinessService,
  createStorageService,
  createTextExtractionService,
  FeatureRepository,
  getDatabase,
  RequirementRepository,
  type DecompositionResult,
  type RequirementStatus,
} from '@entropy/shared';

const logger = createLogger('decomposition-orchestrator');

/**
 * Pipeline stage enumeration
 */
export enum DecompositionStage {
  QUEUED = 'queued',
  EXTRACTING = 'extracting',
  CLASSIFYING = 'classifying',
  DECOMPOSING = 'decomposing',
  SCORING = 'scoring',
  STORING = 'storing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Pipeline error information
 */
export interface PipelineError {
  stage: DecompositionStage;
  code: string;
  message: string;
  retryable: boolean;
  retryCount: number;
}

/**
 * Pipeline state tracking
 */
export interface PipelineState {
  requirementId: string;
  jobId: string;
  stage: DecompositionStage;
  progress: number;
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: PipelineError;
  metadata: {
    extractedTextSize?: number;
    classificationType?: string;
    classificationConfidence?: number;
    themeCount?: number;
    featureCount?: number;
    questionCount?: number;
    decompositionResult?: DecompositionResult;
  };
}

/**
 * Progress update callback type
 */
export type ProgressCallback = (state: PipelineState) => Promise<void>;

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  maxRetries?: number;
  timeoutMs?: number;
  onProgress?: ProgressCallback;
}

/**
 * Stage to progress percentage mapping
 */
const STAGE_PROGRESS: Record<DecompositionStage, number> = {
  [DecompositionStage.QUEUED]: 5,
  [DecompositionStage.EXTRACTING]: 25,
  [DecompositionStage.CLASSIFYING]: 40,
  [DecompositionStage.DECOMPOSING]: 75,
  [DecompositionStage.SCORING]: 90,
  [DecompositionStage.STORING]: 95,
  [DecompositionStage.COMPLETED]: 100,
  [DecompositionStage.FAILED]: 0,
  [DecompositionStage.CANCELLED]: 0,
};

/**
 * Retryable error codes
 */
const RETRYABLE_ERROR_CODES = [
  'ECONNRESET',
  'ETIMEDOUT',
  'RATE_LIMIT',
  'SERVICE_UNAVAILABLE',
  'TIMEOUT',
];

/**
 * Decomposition Orchestrator
 * Coordinates the full pipeline from document upload to decomposed backlog
 */
export class DecompositionOrchestrator {
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly onProgress?: ProgressCallback;

  private db: ReturnType<typeof getDatabase> | null = null;
  private requirementRepo: RequirementRepository | null = null;
  private featureRepo: FeatureRepository | null = null;
  private storageService: ReturnType<typeof createStorageService> | null = null;
  private textExtractionService: ReturnType<typeof createTextExtractionService> | null = null;
  private readinessService: ReturnType<typeof createReadinessService> | null = null;
  private bucket: string;

  constructor(config?: OrchestratorConfig) {
    this.maxRetries = config?.maxRetries ?? 3;
    this.timeoutMs = config?.timeoutMs ?? 120000; // 2 minutes
    this.onProgress = config?.onProgress;
    this.bucket = process.env.S3_BUCKET || 'entropy-artifacts';
  }

  /**
   * Initialize services
   */
  private async initServices(): Promise<void> {
    if (!this.db) {
      this.db = getDatabase();
      await this.db.connect();
    }
    if (!this.requirementRepo) {
      this.requirementRepo = new RequirementRepository(this.db);
    }
    if (!this.featureRepo) {
      this.featureRepo = new FeatureRepository(this.db);
    }
    if (!this.storageService) {
      this.storageService = createStorageService(undefined, this.bucket);
    }
    if (!this.textExtractionService) {
      this.textExtractionService = createTextExtractionService(this.storageService, this.bucket);
    }
    if (!this.readinessService) {
      this.readinessService = createReadinessService();
    }
  }

  /**
   * Execute the full decomposition pipeline
   */
  async execute(requirementId: string): Promise<PipelineState> {
    const jobId = randomUUID();
    const state: PipelineState = {
      requirementId,
      jobId,
      stage: DecompositionStage.QUEUED,
      progress: 5,
      startedAt: new Date(),
      updatedAt: new Date(),
      metadata: {},
    };

    try {
      await this.initServices();
      await this.emitProgress(state);

      // Stage 1: Extract text
      await this.executeWithRetry(
        () => this.extractText(requirementId, state),
        state,
        DecompositionStage.EXTRACTING
      );

      // Stage 2: Classify requirement
      await this.executeWithRetry(
        () => this.classify(requirementId, state),
        state,
        DecompositionStage.CLASSIFYING
      );

      // Stage 3: Decompose into features
      await this.executeWithRetry(
        () => this.decompose(requirementId, state),
        state,
        DecompositionStage.DECOMPOSING
      );

      // Stage 4: Score features for readiness
      await this.score(requirementId, state);

      // Stage 5: Store results
      await this.store(requirementId, state);

      // Complete
      state.stage = DecompositionStage.COMPLETED;
      state.progress = 100;
      state.completedAt = new Date();

      await this.updateRequirementStatus(requirementId, 'decomposed');
      await this.emitProgress(state);

      logger.info('Decomposition pipeline completed', {
        requirementId,
        jobId,
        durationMs: Date.now() - state.startedAt.getTime(),
        featureCount: state.metadata.featureCount,
        questionCount: state.metadata.questionCount,
      });

      return state;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage === 'CANCELLED') {
        state.stage = DecompositionStage.CANCELLED;
      } else {
        state.stage = DecompositionStage.FAILED;
        state.error = {
          stage: state.stage,
          code: (error as { code?: string }).code || 'UNKNOWN_ERROR',
          message: errorMessage,
          retryable: false,
          retryCount: state.error?.retryCount || 0,
        };
      }

      await this.updateRequirementStatus(requirementId, 'failed', errorMessage);
      await this.emitProgress(state);

      logger.error('Decomposition pipeline failed', {
        requirementId,
        jobId,
        stage: state.stage,
        error: state.error,
      });

      return state;
    }
  }

  /**
   * Execute a stage with retry logic
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    state: PipelineState,
    stage: DecompositionStage
  ): Promise<T> {
    state.stage = stage;
    state.progress = STAGE_PROGRESS[stage];
    await this.updateRequirementStatus(state.requirementId, this.stageToStatus(stage));
    await this.emitProgress(state);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await Promise.race([
          fn(),
          this.createTimeout(this.timeoutMs),
        ]) as T;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (!this.isRetryable(lastError)) {
          throw error;
        }

        state.error = {
          stage,
          code: (error as { code?: string }).code || 'TRANSIENT_ERROR',
          message: lastError.message,
          retryable: true,
          retryCount: attempt,
        };

        await this.emitProgress(state);

        logger.warn('Retrying stage', {
          stage,
          attempt,
          maxRetries: this.maxRetries,
          error: lastError.message,
        });

        // Exponential backoff
        await this.sleep(Math.pow(2, attempt) * 1000);
      }
    }

    throw lastError;
  }

  /**
   * Stage 1: Extract text from document
   */
  private async extractText(requirementId: string, state: PipelineState): Promise<void> {
    const requirement = await this.requirementRepo!.findById(requirementId);
    if (!requirement || !requirement.sourceFileS3Key) {
      throw new Error('REQUIREMENT_NOT_FOUND');
    }

    logger.info('Extracting text', { requirementId, s3Key: requirement.sourceFileS3Key });

    const result = await this.textExtractionService!.extractFromS3(requirement.sourceFileS3Key);

    // Get project and client info for S3 path
    const clientId = process.env.DEFAULT_CLIENT_ID || '00000000-0000-0000-0000-000000000001';

    const { textKey } = await this.textExtractionService!.saveExtractedText(
      requirementId,
      requirement.projectId,
      clientId,
      result
    );

    // Update requirement with extracted text location
    await this.requirementRepo!.updateExtractedText(requirementId, textKey);

    state.metadata.extractedTextSize = result.wordCount;

    logger.info('Text extraction complete', {
      requirementId,
      wordCount: result.wordCount,
      pageCount: result.pageCount,
      language: result.detectedLanguage,
    });
  }

  /**
   * Stage 2: Classify requirement type
   */
  private async classify(requirementId: string, state: PipelineState): Promise<void> {
    const requirement = await this.requirementRepo!.findById(requirementId);
    if (!requirement || !requirement.extractedTextS3Key) {
      throw new Error('EXTRACTED_TEXT_NOT_FOUND');
    }

    logger.info('Classifying requirement', { requirementId });

    // Download extracted text
    const textResult = await this.storageService!.download(
      requirement.extractedTextS3Key,
      this.bucket
    );
    if (!textResult) {
      throw new Error('EXTRACTED_TEXT_FILE_NOT_FOUND');
    }

    const extractedText = textResult.content.toString('utf-8');

    // Run classifier agent
    const classifier = createClassifierAgent();
    const classification = await classifier.classify(requirementId, extractedText);

    // Update requirement with classification
    await this.requirementRepo!.updateClassification(
      requirementId,
      classification.type,
      classification.confidence
    );

    state.metadata.classificationType = classification.type;
    state.metadata.classificationConfidence = classification.confidence;

    logger.info('Classification complete', {
      requirementId,
      type: classification.type,
      confidence: classification.confidence,
    });
  }

  /**
   * Stage 3: Decompose into features
   */
  private async decompose(requirementId: string, state: PipelineState): Promise<void> {
    const requirement = await this.requirementRepo!.findById(requirementId);
    if (!requirement || !requirement.extractedTextS3Key || !requirement.type) {
      throw new Error('REQUIREMENT_NOT_CLASSIFIED');
    }

    logger.info('Decomposing requirement', { requirementId, type: requirement.type });

    // Download extracted text
    const textResult = await this.storageService!.download(
      requirement.extractedTextS3Key,
      this.bucket
    );
    if (!textResult) {
      throw new Error('EXTRACTED_TEXT_FILE_NOT_FOUND');
    }

    const extractedText = textResult.content.toString('utf-8');

    // Run decomposer agent
    const decomposer = createDecomposerAgent();
    const decomposition = await decomposer.decompose(
      requirementId,
      extractedText,
      requirement.type
    );

    state.metadata.decompositionResult = decomposition;
    state.metadata.themeCount = decomposition.themes.length;
    state.metadata.featureCount = decomposition.featureCandidates.length;
    state.metadata.questionCount = decomposition.clarificationQuestions.length;

    logger.info('Decomposition complete', {
      requirementId,
      themes: decomposition.themes.length,
      features: decomposition.featureCandidates.length,
      questions: decomposition.clarificationQuestions.length,
    });
  }

  /**
   * Stage 4: Score features for readiness
   */
  private async score(requirementId: string, state: PipelineState): Promise<void> {
    state.stage = DecompositionStage.SCORING;
    state.progress = STAGE_PROGRESS[DecompositionStage.SCORING];
    await this.emitProgress(state);

    const decomposition = state.metadata.decompositionResult;
    if (!decomposition) {
      throw new Error('DECOMPOSITION_RESULT_NOT_FOUND');
    }

    logger.info('Scoring features', { requirementId, featureCount: decomposition.featureCandidates.length });

    // Calculate readiness for each feature
    for (const feature of decomposition.featureCandidates) {
      const featureARs = decomposition.atomicRequirements.filter(
        (ar) => feature.atomicRequirementIds.includes(ar.id)
      );

      const featureQuestions = decomposition.clarificationQuestions.filter(
        (q) => q.featureId === feature.title // Link by title initially
      );

      const score = this.readinessService!.calculateScore(
        {
          id: feature.title, // Use title as temporary ID
          title: feature.title,
          description: feature.description,
          childRequirements: feature.atomicRequirementIds,
          dependencies: [],
        },
        featureARs,
        featureQuestions
      );

      // Attach score to feature
      (feature as unknown as { readinessScore: typeof score }).readinessScore = score;
    }

    logger.info('Scoring complete', { requirementId });
  }

  /**
   * Stage 5: Store results
   */
  private async store(requirementId: string, state: PipelineState): Promise<void> {
    state.stage = DecompositionStage.STORING;
    state.progress = STAGE_PROGRESS[DecompositionStage.STORING];
    await this.emitProgress(state);

    const decomposition = state.metadata.decompositionResult;
    if (!decomposition) {
      throw new Error('DECOMPOSITION_RESULT_NOT_FOUND');
    }

    const requirement = await this.requirementRepo!.findById(requirementId);
    if (!requirement) {
      throw new Error('REQUIREMENT_NOT_FOUND');
    }

    logger.info('Storing results', { requirementId });

    const clientId = process.env.DEFAULT_CLIENT_ID || '00000000-0000-0000-0000-000000000001';
    const basePath = `clients/${clientId}/projects/${requirement.projectId}/requirements/${requirementId}/decomposition`;

    // Store full result to S3
    await this.storageService!.uploadJson(
      `${basePath}/result.json`,
      decomposition,
      {},
      this.bucket
    );

    // Store themes separately
    await this.storageService!.uploadJson(
      `${basePath}/themes.json`,
      decomposition.themes,
      {},
      this.bucket
    );

    // Store features separately
    await this.storageService!.uploadJson(
      `${basePath}/features.json`,
      decomposition.featureCandidates,
      {},
      this.bucket
    );

    // Create feature records in database
    for (const featureCandidate of decomposition.featureCandidates) {
      const readinessScore = (featureCandidate as unknown as { readinessScore?: { overall: number } }).readinessScore;

      await this.featureRepo!.createFeature({
        requirementId,
        projectId: requirement.projectId,
        title: featureCandidate.title,
        description: featureCandidate.description,
        featureType: requirement.type || 'new_feature',
        theme: featureCandidate.theme,
        metadata: {
          atomicRequirementIds: featureCandidate.atomicRequirementIds,
          estimatedComplexity: featureCandidate.estimatedComplexity,
          suggestedPriority: featureCandidate.suggestedPriority,
          readinessScore: readinessScore?.overall || 0,
        },
      });
    }

    logger.info('Results stored', {
      requirementId,
      s3Path: basePath,
      featuresCreated: decomposition.featureCandidates.length,
    });
  }

  /**
   * Update requirement status in database
   */
  private async updateRequirementStatus(
    requirementId: string,
    status: RequirementStatus,
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.requirementRepo!.updateStatus(requirementId, status, undefined, errorMessage);
    } catch (error) {
      logger.error('Failed to update requirement status', { requirementId, status, error });
    }
  }

  /**
   * Map stage to requirement status
   */
  private stageToStatus(stage: DecompositionStage): RequirementStatus {
    const statusMap: Record<DecompositionStage, RequirementStatus> = {
      [DecompositionStage.QUEUED]: 'uploaded',
      [DecompositionStage.EXTRACTING]: 'extracting',
      [DecompositionStage.CLASSIFYING]: 'classifying',
      [DecompositionStage.DECOMPOSING]: 'decomposing',
      [DecompositionStage.SCORING]: 'decomposing',
      [DecompositionStage.STORING]: 'decomposing',
      [DecompositionStage.COMPLETED]: 'decomposed',
      [DecompositionStage.FAILED]: 'failed',
      [DecompositionStage.CANCELLED]: 'failed',
    };
    return statusMap[stage];
  }

  /**
   * Emit progress update
   */
  private async emitProgress(state: PipelineState): Promise<void> {
    state.updatedAt = new Date();

    if (this.onProgress) {
      try {
        await this.onProgress(state);
      } catch (error) {
        logger.error('Progress callback failed', { error });
      }
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: Error): boolean {
    const code = (error as { code?: string }).code;
    if (code && RETRYABLE_ERROR_CODES.includes(code)) {
      return true;
    }
    return error.message.includes('timeout') || error.message.includes('rate limit');
  }

  /**
   * Create timeout promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error('TIMEOUT');
        (error as { code?: string }).code = 'TIMEOUT';
        reject(error);
      }, ms);
    });
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a decomposition orchestrator instance
 */
export function createDecompositionOrchestrator(
  config?: OrchestratorConfig
): DecompositionOrchestrator {
  return new DecompositionOrchestrator(config);
}
