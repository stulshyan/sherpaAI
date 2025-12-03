// Health check routes with detailed system status

import { getAdapterRegistry } from '@entropy/adapters';
import { createLogger } from '@entropy/shared';
import type { HealthCheckResult } from '@entropy/shared';
import { Router, type IRouter } from 'express';

const logger = createLogger('health');

export const healthRouter: IRouter = Router();

// Database client (lazy loaded to avoid circular deps)
let dbClient: {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  getPoolStats?: () => { totalCount: number; idleCount: number; waitingCount: number };
  isHealthy?: () => Promise<boolean>;
} | null = null;

// Try to get database client
async function getDbClient() {
  if (dbClient) return dbClient;
  try {
    const { getDatabase } = await import('@entropy/shared');
    dbClient = getDatabase();
    return dbClient;
  } catch {
    return null;
  }
}

// Storage service (lazy loaded)
let storageService: {
  list: (prefix: string, bucket?: string, maxKeys?: number) => Promise<{
    objects: Array<{ key: string; size: number; lastModified: Date }>;
  }>;
} | null = null;

async function getStorageService() {
  if (storageService) return storageService;
  try {
    const { createStorageService } = await import('@entropy/shared');
    const bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
    if (!bucket) return null;
    storageService = createStorageService(undefined, bucket);
    return storageService;
  } catch {
    return null;
  }
}

// Cache service (lazy loaded)
let cacheService: {
  isHealthy: () => Promise<boolean>;
  getInfo: () => Promise<Record<string, string>>;
  connect: () => Promise<void>;
} | null = null;

async function getCacheService() {
  if (cacheService) return cacheService;
  try {
    const { createCacheService } = await import('@entropy/shared');
    const service = createCacheService() as {
      isHealthy: () => Promise<boolean>;
      getInfo: () => Promise<Record<string, string>>;
      connect: () => Promise<void>;
    };
    await service.connect();
    cacheService = service;
    return cacheService;
  } catch {
    return null;
  }
}

/**
 * GET /health
 * Basic health check
 */
healthRouter.get('/', async (_req, res) => {
  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date(),
    services: {
      api: { status: 'up' },
    },
  };

  res.json(result);
});

/**
 * GET /health/detailed
 * Detailed health check with all services
 */
healthRouter.get('/detailed', async (_req, res) => {
  const startTime = Date.now();
  const result: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    services: {
      api: { status: 'up'; latencyMs: number };
      database?: {
        status: 'up' | 'down';
        latencyMs: number;
        tables: Array<{ name: string; rowCount: number }>;
        poolStats?: { totalCount: number; idleCount: number; waitingCount: number };
      };
      storage?: {
        status: 'up' | 'down' | 'not_configured';
        bucket?: string;
        objectCount?: number;
        totalSizeBytes?: number;
        recentObjects?: Array<{ key: string; size: number; lastModified: string }>;
        message?: string;
      };
      cache?: {
        status: 'up' | 'down' | 'not_configured';
        latencyMs?: number;
        memoryUsedMb?: number;
        keyCount?: number;
        hitRate?: number;
        message?: string;
      };
    };
    adapters?: Array<{
      id: string;
      provider: string;
      model: string;
      healthy: boolean;
      latencyMs?: number;
    }>;
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      api: { status: 'up', latencyMs: 0 },
    },
  };

  let hasUnhealthy = false;
  let hasDegraded = false;

  // Check Database
  try {
    const db = await getDbClient();
    if (db) {
      const dbStart = Date.now();
      await db.query('SELECT 1');
      const dbLatency = Date.now() - dbStart;

      // Get table counts
      const tablesQuery = await db.query(`
        SELECT
          schemaname || '.' || relname as name,
          n_live_tup as row_count
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
        LIMIT 20
      `);

      const tables = (tablesQuery.rows as Array<{ name: string; row_count: number }>).map((row) => ({
        name: row.name,
        rowCount: Number(row.row_count),
      }));

      result.services.database = {
        status: 'up',
        latencyMs: dbLatency,
        tables,
        poolStats: db.getPoolStats?.(),
      };
    } else {
      result.services.database = {
        status: 'down',
        latencyMs: 0,
        tables: [],
      };
      hasDegraded = true;
    }
  } catch (error) {
    logger.error('Database health check failed', { error });
    result.services.database = {
      status: 'down',
      latencyMs: 0,
      tables: [],
    };
    hasUnhealthy = true;
  }

  // Check Storage (S3)
  try {
    const bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
    if (!bucket) {
      result.services.storage = {
        status: 'not_configured',
        message: 'S3_BUCKET environment variable not set',
      };
    } else {
      const storage = await getStorageService();
      if (storage) {
        const listResult = await storage.list('', bucket, 10);
        const totalSize = listResult.objects.reduce((sum, obj) => sum + obj.size, 0);

        result.services.storage = {
          status: 'up',
          bucket,
          objectCount: listResult.objects.length,
          totalSizeBytes: totalSize,
          recentObjects: listResult.objects.slice(0, 5).map((obj) => ({
            key: obj.key,
            size: obj.size,
            lastModified: obj.lastModified.toISOString(),
          })),
        };
      } else {
        result.services.storage = {
          status: 'not_configured',
          message: 'Storage service not available',
        };
      }
    }
  } catch (error) {
    logger.error('Storage health check failed', { error });
    result.services.storage = {
      status: 'down',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    hasDegraded = true;
  }

  // Check Cache (Redis)
  try {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      result.services.cache = {
        status: 'not_configured',
        message: 'REDIS_URL environment variable not set',
      };
    } else {
      const cache = await getCacheService();
      if (cache) {
        const cacheStart = Date.now();
        const healthy = await cache.isHealthy();
        const cacheLatency = Date.now() - cacheStart;

        if (healthy) {
          const info = await cache.getInfo();
          result.services.cache = {
            status: 'up',
            latencyMs: cacheLatency,
            memoryUsedMb: parseFloat(info.used_memory_human || '0'),
            keyCount: parseInt(info.db0?.split(',')[0]?.split('=')[1] || '0', 10),
            hitRate:
              info.keyspace_hits && info.keyspace_misses
                ? parseInt(info.keyspace_hits, 10) /
                  (parseInt(info.keyspace_hits, 10) + parseInt(info.keyspace_misses, 10))
                : undefined,
          };
        } else {
          result.services.cache = {
            status: 'down',
            message: 'Redis ping failed',
          };
          hasDegraded = true;
        }
      } else {
        result.services.cache = {
          status: 'not_configured',
          message: 'Cache service not available',
        };
      }
    }
  } catch (error) {
    logger.error('Cache health check failed', { error });
    result.services.cache = {
      status: 'down',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    hasDegraded = true;
  }

  // Check Adapters
  try {
    const registry = getAdapterRegistry();
    const adapters = registry.list();
    const adapterResults: Array<{
      id: string;
      provider: string;
      model: string;
      healthy: boolean;
      latencyMs?: number;
    }> = [];

    for (const config of adapters) {
      try {
        const adapter = registry.get(config.id);
        const adapterStart = Date.now();
        const healthy = await adapter.healthCheck();
        const adapterLatency = Date.now() - adapterStart;

        adapterResults.push({
          id: config.id,
          provider: config.provider,
          model: config.model,
          healthy,
          latencyMs: adapterLatency,
        });

        if (!healthy) {
          hasDegraded = true;
        }
      } catch (error) {
        logger.error('Adapter health check failed', { adapterId: config.id, error });
        adapterResults.push({
          id: config.id,
          provider: config.provider,
          model: config.model,
          healthy: false,
        });
        hasDegraded = true;
      }
    }

    result.adapters = adapterResults;
  } catch (error) {
    logger.error('Failed to check adapters', { error });
  }

  // Set overall status
  if (hasUnhealthy) {
    result.status = 'unhealthy';
  } else if (hasDegraded) {
    result.status = 'degraded';
  }

  result.services.api.latencyMs = Date.now() - startTime;

  res.json(result);
});

/**
 * GET /health/ready
 * Readiness check for Kubernetes
 */
healthRouter.get('/ready', async (_req, res) => {
  try {
    const db = await getDbClient();
    if (db) {
      await db.query('SELECT 1');
    }
    res.json({ ready: true });
  } catch {
    res.status(503).json({ ready: false });
  }
});

/**
 * GET /health/live
 * Liveness check for Kubernetes
 */
healthRouter.get('/live', (_req, res) => {
  res.json({ alive: true });
});

/**
 * GET /health/db
 * Database-specific health check
 */
healthRouter.get('/db', async (_req, res) => {
  try {
    const db = await getDbClient();
    if (!db) {
      res.status(503).json({ status: 'down', message: 'Database client not available' });
      return;
    }

    const startTime = Date.now();
    await db.query('SELECT 1');
    const latencyMs = Date.now() - startTime;

    // Get table stats
    const tablesQuery = await db.query(`
      SELECT
        schemaname || '.' || relname as name,
        n_live_tup as row_count,
        pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname)) as size_bytes
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC
    `);

    res.json({
      status: 'up',
      latencyMs,
      tables: tablesQuery.rows,
      poolStats: db.getPoolStats?.(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /health/storage
 * S3 storage health check
 */
healthRouter.get('/storage', async (_req, res) => {
  try {
    const bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
    if (!bucket) {
      res.json({
        status: 'not_configured',
        message: 'S3_BUCKET environment variable not set',
      });
      return;
    }

    const storage = await getStorageService();
    if (!storage) {
      res.status(503).json({ status: 'down', message: 'Storage service not available' });
      return;
    }

    const listResult = await storage.list('', bucket, 100);
    const totalSize = listResult.objects.reduce((sum, obj) => sum + obj.size, 0);

    res.json({
      status: 'up',
      bucket,
      objectCount: listResult.objects.length,
      totalSizeBytes: totalSize,
      recentObjects: listResult.objects.slice(0, 10),
    });
  } catch (error) {
    res.status(503).json({
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /health/cache
 * Redis cache health check
 */
healthRouter.get('/cache', async (_req, res) => {
  try {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      res.json({
        status: 'not_configured',
        message: 'REDIS_URL environment variable not set',
      });
      return;
    }

    const cache = await getCacheService();
    if (!cache) {
      res.status(503).json({ status: 'down', message: 'Cache service not available' });
      return;
    }

    const startTime = Date.now();
    const healthy = await cache.isHealthy();
    const latencyMs = Date.now() - startTime;

    if (!healthy) {
      res.status(503).json({ status: 'down', message: 'Redis ping failed' });
      return;
    }

    const info = await cache.getInfo();

    res.json({
      status: 'up',
      latencyMs,
      info: {
        redisVersion: info.redis_version,
        uptimeSeconds: parseInt(info.uptime_in_seconds || '0', 10),
        connectedClients: parseInt(info.connected_clients || '0', 10),
        usedMemoryHuman: info.used_memory_human,
        totalSystemMemoryHuman: info.total_system_memory_human,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
