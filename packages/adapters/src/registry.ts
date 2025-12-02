// Adapter registry for managing multiple adapters

import type { ModelAdapter, AdapterConfig } from '@entropy/shared';
import { createLogger } from '@entropy/shared';
import { AdapterFactory } from './factory.js';

const logger = createLogger('adapter-registry');

export interface RegistryConfig {
  adapters: AdapterConfig[];
  defaultAdapterId?: string;
}

/**
 * Registry for managing and accessing model adapters
 */
export class AdapterRegistry {
  private adapters: Map<string, ModelAdapter> = new Map();
  private configs: Map<string, AdapterConfig> = new Map();
  private defaultAdapterId?: string;

  constructor(config?: RegistryConfig) {
    if (config) {
      this.initialize(config);
    }
  }

  /**
   * Initialize registry with configurations
   */
  initialize(config: RegistryConfig): void {
    this.adapters.clear();
    this.configs.clear();

    for (const adapterConfig of config.adapters) {
      this.configs.set(adapterConfig.id, adapterConfig);
    }

    this.defaultAdapterId = config.defaultAdapterId || config.adapters[0]?.id;

    logger.info('Registry initialized', {
      adapterCount: config.adapters.length,
      defaultAdapterId: this.defaultAdapterId,
    });
  }

  /**
   * Get an adapter by ID (lazy-loaded)
   */
  get(id: string): ModelAdapter {
    // Return cached adapter if exists
    let adapter = this.adapters.get(id);
    if (adapter) {
      return adapter;
    }

    // Create adapter from config
    const config = this.configs.get(id);
    if (!config) {
      throw new Error(`Adapter not found: ${id}`);
    }

    adapter = AdapterFactory.create(config);
    this.adapters.set(id, adapter);

    logger.info('Adapter created', { id, provider: config.provider });
    return adapter;
  }

  /**
   * Get the default adapter
   */
  getDefault(): ModelAdapter {
    if (!this.defaultAdapterId) {
      throw new Error('No default adapter configured');
    }
    return this.get(this.defaultAdapterId);
  }

  /**
   * Check if an adapter exists
   */
  has(id: string): boolean {
    return this.configs.has(id);
  }

  /**
   * List all configured adapters
   */
  list(): AdapterConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Reload adapters from new configuration
   * Clears cached instances to pick up new settings
   */
  async reload(config: RegistryConfig): Promise<void> {
    logger.info('Reloading adapter registry');

    // Health check existing adapters before reload
    for (const [id, adapter] of this.adapters) {
      try {
        await adapter.healthCheck();
      } catch (error) {
        logger.warn('Adapter health check failed during reload', {
          id,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    this.initialize(config);
  }

  /**
   * Run health checks on all adapters
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const config of this.configs.values()) {
      try {
        const adapter = this.get(config.id);
        const healthy = await adapter.healthCheck();
        results.set(config.id, healthy);
      } catch {
        results.set(config.id, false);
      }
    }

    return results;
  }

  /**
   * Get adapter configuration
   */
  getConfig(id: string): AdapterConfig | undefined {
    return this.configs.get(id);
  }

  /**
   * Update adapter configuration
   */
  updateConfig(id: string, updates: Partial<AdapterConfig>): void {
    const existing = this.configs.get(id);
    if (!existing) {
      throw new Error(`Adapter not found: ${id}`);
    }

    const updated = { ...existing, ...updates };
    this.configs.set(id, updated);

    // Clear cached adapter to pick up new config
    this.adapters.delete(id);

    logger.info('Adapter config updated', { id });
  }
}

// Global registry instance
let globalRegistry: AdapterRegistry | undefined;

/**
 * Get or create the global adapter registry
 */
export function getAdapterRegistry(): AdapterRegistry {
  if (!globalRegistry) {
    globalRegistry = new AdapterRegistry();
  }
  return globalRegistry;
}

/**
 * Initialize the global adapter registry
 */
export function initializeAdapterRegistry(config: RegistryConfig): void {
  globalRegistry = new AdapterRegistry(config);
}
