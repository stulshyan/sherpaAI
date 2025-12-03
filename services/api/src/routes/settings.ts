// Settings routes for API key and configuration management

import { getAdapterRegistry } from '@entropy/adapters';
import { createLogger } from '@entropy/shared';
import { Router, type IRouter, type Request, type Response } from 'express';

const logger = createLogger('settings');

export const settingsRouter: IRouter = Router();

// In-memory storage for API keys (in production, use secure storage)
interface ApiKeys {
  anthropic?: string;
  openai?: string;
  google?: string;
}

const apiKeys: ApiKeys = {};

/**
 * GET /api/v1/settings/api-keys
 * Get configured API keys (masked)
 */
settingsRouter.get('/api-keys', (_req: Request, res: Response) => {
  const masked: Record<string, { configured: boolean; preview: string }> = {};

  for (const [provider, key] of Object.entries(apiKeys)) {
    if (key) {
      masked[provider] = {
        configured: true,
        preview: key.slice(0, 7) + '...' + key.slice(-4),
      };
    }
  }

  res.json({
    keys: masked,
    providers: ['anthropic', 'openai', 'google'],
  });
});

/**
 * POST /api/v1/settings/api-keys
 * Save API keys and update adapter configs
 */
settingsRouter.post('/api-keys', (req: Request, res: Response) => {
  const { anthropic, openai, google } = req.body;

  // Update stored keys (only if provided and not empty)
  if (anthropic !== undefined && anthropic !== '') {
    apiKeys.anthropic = anthropic;
  }
  if (openai !== undefined && openai !== '') {
    apiKeys.openai = openai;
  }
  if (google !== undefined && google !== '') {
    apiKeys.google = google;
  }

  // Update adapter configs with new API keys
  const registry = getAdapterRegistry();

  try {
    // Update Anthropic adapters
    if (apiKeys.anthropic) {
      for (const config of registry.list()) {
        if (config.provider === 'anthropic') {
          registry.updateConfig(config.id, { apiKey: apiKeys.anthropic });
          logger.info('Updated Anthropic adapter with API key', { adapterId: config.id });
        }
      }
    }

    // Update OpenAI adapters
    if (apiKeys.openai) {
      for (const config of registry.list()) {
        if (config.provider === 'openai') {
          registry.updateConfig(config.id, { apiKey: apiKeys.openai });
          logger.info('Updated OpenAI adapter with API key', { adapterId: config.id });
        }
      }
    }

    // Update Google adapters
    if (apiKeys.google) {
      for (const config of registry.list()) {
        if (config.provider === 'google') {
          registry.updateConfig(config.id, { apiKey: apiKeys.google });
          logger.info('Updated Google adapter with API key', { adapterId: config.id });
        }
      }
    }

    logger.info('API keys saved successfully');

    res.json({
      success: true,
      message: 'API keys saved successfully',
      configured: {
        anthropic: !!apiKeys.anthropic,
        openai: !!apiKeys.openai,
        google: !!apiKeys.google,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to save API keys', { error: message });
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/v1/settings/api-keys/:provider
 * Remove an API key
 */
settingsRouter.delete('/api-keys/:provider', (req: Request, res: Response) => {
  const provider = req.params.provider;

  if (!provider || !['anthropic', 'openai', 'google'].includes(provider)) {
    res.status(400).json({ error: `Invalid provider: ${provider}` });
    return;
  }

  delete apiKeys[provider as keyof ApiKeys];

  logger.info('API key removed', { provider });

  res.json({
    success: true,
    message: `${provider} API key removed`,
  });
});

/**
 * GET /api/v1/settings/api-keys/status
 * Check which API keys are configured and working
 */
settingsRouter.get('/api-keys/status', async (_req: Request, res: Response) => {
  const status: Record<string, { configured: boolean; healthy: boolean | null }> = {
    anthropic: { configured: !!apiKeys.anthropic, healthy: null },
    openai: { configured: !!apiKeys.openai, healthy: null },
    google: { configured: !!apiKeys.google, healthy: null },
  };

  // Try health checks for configured providers
  const registry = getAdapterRegistry();

  for (const config of registry.list()) {
    const providerStatus = status[config.provider];
    if (providerStatus && providerStatus.configured) {
      try {
        const adapter = registry.get(config.id);
        providerStatus.healthy = await adapter.healthCheck();
      } catch {
        providerStatus.healthy = false;
      }
    }
  }

  res.json({ status });
});
