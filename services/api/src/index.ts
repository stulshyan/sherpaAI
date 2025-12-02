// API Service Entry Point

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createLogger } from '@entropy/shared';
import { getEnvConfig } from '@entropy/config';
import { initializeAdapterRegistry } from '@entropy/adapters';
import { getModelConfigManager } from '@entropy/config';
import { healthRouter } from './routes/health.js';
import { requirementsRouter } from './routes/requirements.js';
import { featuresRouter } from './routes/features.js';
import { backlogRouter } from './routes/backlog.js';
import { errorHandler } from './middleware/error-handler.js';

const logger = createLogger('api');

async function main() {
  const config = getEnvConfig();
  const app = express();

  // Initialize model adapters
  const modelConfig = getModelConfigManager();
  initializeAdapterRegistry({
    adapters: modelConfig.getConfig().adapters,
    defaultAdapterId: modelConfig.getConfig().defaultAdapterId,
  });

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));

  // Routes
  app.use('/health', healthRouter);
  app.use('/api/v1/requirements', requirementsRouter);
  app.use('/api/v1/features', featuresRouter);
  app.use('/api/v1/backlog', backlogRouter);

  // Error handling
  app.use(errorHandler);

  // Start server
  const port = config.PORT;
  const host = config.HOST;

  app.listen(port, host, () => {
    logger.info('API server started', { port, host });
  });
}

main().catch((error) => {
  logger.error('Failed to start API server', { error: error.message });
  process.exit(1);
});
