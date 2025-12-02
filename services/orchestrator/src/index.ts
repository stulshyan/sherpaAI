// Orchestrator Service Entry Point

import { createLogger } from '@entropy/shared';
import { getEnvConfig } from '@entropy/config';
import { initializeAdapterRegistry } from '@entropy/adapters';
import { getModelConfigManager } from '@entropy/config';
import { DecompositionWorker } from './workers/decomposition.worker.js';

const logger = createLogger('orchestrator');

async function main() {
  const config = getEnvConfig();

  logger.info('Starting orchestrator service');

  // Initialize model adapters
  const modelConfig = getModelConfigManager();
  initializeAdapterRegistry({
    adapters: modelConfig.getConfig().adapters,
    defaultAdapterId: modelConfig.getConfig().defaultAdapterId,
  });

  // Start workers
  const decompositionWorker = new DecompositionWorker();
  await decompositionWorker.start();

  // Handle shutdown
  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down');
    await decompositionWorker.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down');
    await decompositionWorker.stop();
    process.exit(0);
  });

  logger.info('Orchestrator service started');
}

main().catch((error) => {
  logger.error('Failed to start orchestrator', { error: error.message });
  process.exit(1);
});
