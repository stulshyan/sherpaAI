// Test Harness API Routes
// Provides endpoints for testing model adapters

import { getAdapterRegistry } from '@entropy/adapters';
import { createLogger } from '@entropy/shared';
import type { CompletionRequest, AdapterConfig, TokenUsage } from '@entropy/shared';
import { Router, type IRouter, type Request, type Response } from 'express';

const logger = createLogger('test-harness');

export const testHarnessRouter: IRouter = Router();

// In-memory test configuration (for hot-swap testing)
interface TestConfig {
  adapterId: string;
  temperature: number;
  maxTokens: number;
  simulateFailure: boolean;
  simulateLatencyMs: number;
}

let testConfig: TestConfig = {
  adapterId: 'anthropic-claude-4-sonnet',
  temperature: 0.7,
  maxTokens: 1024,
  simulateFailure: false,
  simulateLatencyMs: 0,
};

/**
 * GET /api/v1/test-harness/config
 * Get current test configuration
 */
testHarnessRouter.get('/config', (_req: Request, res: Response) => {
  res.json(testConfig);
});

/**
 * PATCH /api/v1/test-harness/config
 * Update test configuration (hot-swap)
 */
testHarnessRouter.patch('/config', (req: Request, res: Response) => {
  const updates = req.body;

  // Validate adapterId if provided
  if (updates.adapterId) {
    const registry = getAdapterRegistry();
    if (!registry.has(updates.adapterId)) {
      res.status(400).json({
        error: `Invalid adapter ID: ${updates.adapterId}`,
        availableAdapters: registry.list().map((a) => a.id),
      });
      return;
    }
  }

  testConfig = { ...testConfig, ...updates };
  logger.info('Test config updated', { ...testConfig });

  res.json({ success: true, config: testConfig });
});

/**
 * GET /api/v1/test-harness/adapters
 * List all available adapters
 */
testHarnessRouter.get('/adapters', (_req: Request, res: Response) => {
  const registry = getAdapterRegistry();
  const adapters = registry.list();

  res.json({
    adapters: adapters.map((config: AdapterConfig) => ({
      id: config.id,
      provider: config.provider,
      model: config.model,
    })),
    defaultAdapterId: testConfig.adapterId,
  });
});

/**
 * POST /api/v1/test-harness/complete
 * Test completion with current config
 */
testHarnessRouter.post('/complete', async (req: Request, res: Response) => {
  const { prompt, systemPrompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  // Simulate failure if enabled
  if (testConfig.simulateFailure) {
    logger.warn('Simulated failure triggered');
    res.status(503).json({
      error: 'Simulated API failure',
      simulatedFailure: true,
      message: 'This failure was intentionally triggered for testing',
    });
    return;
  }

  // Simulate latency if configured
  if (testConfig.simulateLatencyMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, testConfig.simulateLatencyMs));
  }

  try {
    const registry = getAdapterRegistry();
    const adapter = registry.get(testConfig.adapterId);
    const adapterConfig = registry.getConfig(testConfig.adapterId);

    const request: CompletionRequest = {
      messages: [{ role: 'user', content: prompt }],
      model: adapterConfig?.model || 'claude-sonnet-4-5-20250929',
      temperature: testConfig.temperature,
      maxTokens: testConfig.maxTokens,
      systemPrompt,
    };

    logger.info('Sending test completion request', {
      adapterId: testConfig.adapterId,
      model: request.model,
    });

    const startTime = Date.now();
    const response = await adapter.complete(request);
    const actualLatencyMs = Date.now() - startTime;

    // Calculate cost
    const costUsd = adapter.estimateCost(response.usage);

    res.json({
      content: response.content,
      model: response.model,
      finishReason: response.finishReason,
      requestId: response.requestId,
      metrics: {
        latencyMs: actualLatencyMs,
        tokensIn: response.usage.inputTokens,
        tokensOut: response.usage.outputTokens,
        totalTokens: response.usage.totalTokens,
        costUsd: costUsd,
      },
      config: {
        adapterId: testConfig.adapterId,
        temperature: testConfig.temperature,
        maxTokens: testConfig.maxTokens,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Test completion failed', { error: message });

    res.status(500).json({
      error: message,
      adapterId: testConfig.adapterId,
    });
  }
});

/**
 * POST /api/v1/test-harness/stream
 * Test streaming completion (Server-Sent Events)
 */
testHarnessRouter.post('/stream', async (req: Request, res: Response) => {
  const { prompt, systemPrompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Simulate failure if enabled
  if (testConfig.simulateFailure) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Simulated API failure' })}\n\n`);
    res.end();
    return;
  }

  try {
    const registry = getAdapterRegistry();
    const adapter = registry.get(testConfig.adapterId);
    const adapterConfig = registry.getConfig(testConfig.adapterId);

    const request: CompletionRequest = {
      messages: [{ role: 'user', content: prompt }],
      model: adapterConfig?.model || 'claude-sonnet-4-5-20250929',
      temperature: testConfig.temperature,
      maxTokens: testConfig.maxTokens,
      systemPrompt,
    };

    const startTime = Date.now();

    for await (const chunk of adapter.stream(request)) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);

      if (chunk.type === 'done' && chunk.usage) {
        // Send final metrics
        const latencyMs = Date.now() - startTime;
        const costUsd = adapter.estimateCost(chunk.usage);
        res.write(
          `data: ${JSON.stringify({
            type: 'metrics',
            metrics: {
              latencyMs,
              tokensIn: chunk.usage.inputTokens,
              tokensOut: chunk.usage.outputTokens,
              totalTokens: chunk.usage.totalTokens,
              costUsd,
            },
          })}\n\n`
        );
      }
    }

    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.write(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`);
    res.end();
  }
});

/**
 * POST /api/v1/test-harness/health
 * Check health of specific or all adapters
 */
testHarnessRouter.post('/health', async (req: Request, res: Response) => {
  const { adapterId } = req.body;

  try {
    const registry = getAdapterRegistry();

    if (adapterId) {
      // Check specific adapter
      const adapter = registry.get(adapterId);
      const healthy = await adapter.healthCheck();
      res.json({ adapterId, healthy });
    } else {
      // Check all adapters
      const results = await registry.healthCheck();
      const healthStatus: Record<string, boolean> = {};
      results.forEach((healthy, id) => {
        healthStatus[id] = healthy;
      });
      res.json({ adapters: healthStatus });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/v1/test-harness/count-tokens
 * Count tokens in a text string
 */
testHarnessRouter.post('/count-tokens', (req: Request, res: Response) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'text is required' });
    return;
  }

  try {
    const registry = getAdapterRegistry();
    const adapter = registry.get(testConfig.adapterId);
    const tokenCount = adapter.countTokens(text);

    res.json({
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      tokenCount,
      adapterId: testConfig.adapterId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/v1/test-harness/estimate-cost
 * Estimate cost for given token usage
 */
testHarnessRouter.post('/estimate-cost', (req: Request, res: Response) => {
  const { inputTokens, outputTokens } = req.body;

  if (typeof inputTokens !== 'number' || typeof outputTokens !== 'number') {
    res.status(400).json({ error: 'inputTokens and outputTokens are required' });
    return;
  }

  try {
    const registry = getAdapterRegistry();
    const adapter = registry.get(testConfig.adapterId);

    const usage: TokenUsage = {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    };

    const costUsd = adapter.estimateCost(usage);

    res.json({
      usage,
      costUsd,
      adapterId: testConfig.adapterId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
