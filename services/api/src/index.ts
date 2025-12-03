// API Service Entry Point

import { initializeAdapterRegistry } from '@entropy/adapters';
import { getEnvConfig, getModelConfigManager } from '@entropy/config';
import { createLogger } from '@entropy/shared';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler } from './middleware/error-handler.js';
import { backlogRouter } from './routes/backlog.js';
import { featuresRouter } from './routes/features.js';
import { healthRouter } from './routes/health.js';
import { intakeRouter } from './routes/intake.js';
import { requirementsRouter } from './routes/requirements.js';
import { testHarnessRouter } from './routes/test-harness.js';

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

  // Root route
  app.get('/', (_req, res) => {
    res.json({
      name: 'Entropy Platform API',
      version: '0.1.0',
      endpoints: {
        health: '/health',
        testHarness: '/api/v1/test-harness',
        requirements: '/api/v1/requirements',
        features: '/api/v1/features',
        backlog: '/api/v1/backlog',
        intake: '/api/v1/intake',
      },
    });
  });

  // Routes
  app.use('/health', healthRouter);
  app.use('/api/v1/health', healthRouter); // Also serve health under /api/v1
  app.use('/api/v1/requirements', requirementsRouter);
  app.use('/api/v1/features', featuresRouter);
  app.use('/api/v1/backlog', backlogRouter);
  app.use('/api/v1/intake', intakeRouter);
  app.use('/api/v1/test-harness', testHarnessRouter);

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
