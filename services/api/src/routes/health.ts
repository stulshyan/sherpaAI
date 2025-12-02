// Health check routes

import type { HealthCheckResult } from '@entropy/shared';
import { Router, type IRouter } from 'express';

export const healthRouter: IRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date(),
    services: {
      api: { status: 'up' },
      // TODO: Add database, redis, s3 health checks
    },
  };

  res.json(result);
});

healthRouter.get('/ready', async (_req, res) => {
  // Readiness check for Kubernetes
  // TODO: Check database and redis connections
  res.json({ ready: true });
});

healthRouter.get('/live', (_req, res) => {
  // Liveness check for Kubernetes
  res.json({ alive: true });
});
