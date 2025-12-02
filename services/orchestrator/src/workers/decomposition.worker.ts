// Decomposition worker

import { createClassifierAgent, createDecomposerAgent } from '@entropy/agents';
import { createLogger } from '@entropy/shared';

const logger = createLogger('decomposition-worker');

export interface DecompositionJob {
  requirementId: string;
  projectId: string;
  requirementText: string;
}

export class DecompositionWorker {
  private _running = false;
  private classifierAgent;
  private decomposerAgent;

  get isRunning(): boolean {
    return this._running;
  }

  constructor() {
    this.classifierAgent = createClassifierAgent();
    this.decomposerAgent = createDecomposerAgent();
  }

  async start(): Promise<void> {
    logger.info('Starting decomposition worker');
    this._running = true;

    // TODO: Connect to BullMQ and process jobs
    // For now, this is a placeholder
  }

  async stop(): Promise<void> {
    logger.info('Stopping decomposition worker');
    this._running = false;
  }

  async processJob(job: DecompositionJob): Promise<void> {
    logger.info('Processing decomposition job', {
      requirementId: job.requirementId,
      projectId: job.projectId,
    });

    try {
      // Step 1: Classify the requirement
      const classification = await this.classifierAgent.classify(
        job.requirementId,
        job.requirementText
      );

      logger.info('Requirement classified', {
        requirementId: job.requirementId,
        type: classification.type,
        confidence: classification.confidence,
      });

      // Step 2: Decompose if suggested
      if (classification.suggestedDecomposition) {
        const decomposition = await this.decomposerAgent.decompose(
          job.requirementId,
          job.requirementText,
          classification.type
        );

        logger.info('Requirement decomposed', {
          requirementId: job.requirementId,
          themes: decomposition.themes.length,
          atomicRequirements: decomposition.atomicRequirements.length,
          featureCandidates: decomposition.featureCandidates.length,
          questions: decomposition.clarificationQuestions.length,
        });

        // TODO: Store results in database and S3
      }

      // TODO: Update requirement status
    } catch (error) {
      logger.error('Decomposition job failed', {
        requirementId: job.requirementId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      throw error;
    }
  }
}
