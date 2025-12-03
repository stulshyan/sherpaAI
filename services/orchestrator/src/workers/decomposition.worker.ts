// Decomposition worker for S-039
// Processes decomposition jobs using the orchestrator

import { createLogger, getDatabase, RequirementRepository } from '@entropy/shared';
import { createDecompositionOrchestrator, type PipelineState } from '../decomposition-orchestrator.js';

const logger = createLogger('decomposition-worker');

export interface DecompositionJob {
  requirementId: string;
  projectId: string;
  priority?: 'normal' | 'high';
  force?: boolean;
}

export class DecompositionWorker {
  private _running = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private processingJobs = new Set<string>();
  private requirementRepo: RequirementRepository | null = null;

  get isRunning(): boolean {
    return this._running;
  }

  constructor() {
    // Services will be initialized on start
  }

  async start(): Promise<void> {
    logger.info('Starting decomposition worker');
    this._running = true;

    // Initialize database connection
    const db = getDatabase();
    await db.connect();
    this.requirementRepo = new RequirementRepository(db);

    // Start polling for pending jobs
    // In production, this would be replaced with BullMQ job queue
    this.startPolling();
  }

  async stop(): Promise<void> {
    logger.info('Stopping decomposition worker');
    this._running = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Wait for any in-progress jobs to complete
    while (this.processingJobs.size > 0) {
      logger.info('Waiting for jobs to complete', { count: this.processingJobs.size });
      await this.sleep(1000);
    }
  }

  /**
   * Start polling for pending requirements
   */
  private startPolling(): void {
    // Poll every 5 seconds for pending requirements
    this.pollInterval = setInterval(async () => {
      if (!this._running) return;

      try {
        await this.pollForJobs();
      } catch (error) {
        logger.error('Polling error', { error });
      }
    }, 5000);

    // Initial poll
    this.pollForJobs().catch((error) => {
      logger.error('Initial poll error', { error });
    });
  }

  /**
   * Poll for pending requirements to process
   */
  private async pollForJobs(): Promise<void> {
    if (!this.requirementRepo) return;

    // Find requirements in 'extracting' status (triggered by API)
    const pending = await this.requirementRepo.findByStatus('extracting');

    for (const requirement of pending) {
      // Skip if already processing
      if (this.processingJobs.has(requirement.id)) continue;

      // Process the job
      this.processJob({
        requirementId: requirement.id,
        projectId: requirement.projectId,
      }).catch((error) => {
        logger.error('Job processing failed', {
          requirementId: requirement.id,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  /**
   * Process a decomposition job
   */
  async processJob(job: DecompositionJob): Promise<PipelineState> {
    logger.info('Processing decomposition job', {
      requirementId: job.requirementId,
      projectId: job.projectId,
    });

    this.processingJobs.add(job.requirementId);

    try {
      // Create orchestrator with progress callback
      const orchestrator = createDecompositionOrchestrator({
        maxRetries: 3,
        timeoutMs: 120000,
        onProgress: async (state) => {
          logger.debug('Pipeline progress', {
            requirementId: state.requirementId,
            stage: state.stage,
            progress: state.progress,
          });
          // In production, store progress in Redis for API polling
        },
      });

      // Execute the full pipeline
      const result = await orchestrator.execute(job.requirementId);

      logger.info('Decomposition job completed', {
        requirementId: job.requirementId,
        status: result.stage,
        featureCount: result.metadata.featureCount,
      });

      return result;
    } finally {
      this.processingJobs.delete(job.requirementId);
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
