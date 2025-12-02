// Hot-swappable model configuration

import type { AdapterConfig, ModelProvider, AgentConfig, AgentType } from '@entropy/shared';
import { createLogger } from '@entropy/shared';
import { getEnvConfig } from './env.js';

const logger = createLogger('model-config');

export interface ModelConfiguration {
  adapters: AdapterConfig[];
  defaultAdapterId: string;
  agentConfigs: Record<string, AgentConfig>;
  fallbackChains: Record<string, string[]>;
}

// Configuration sources (priority order, lowest to highest)
export enum ConfigSource {
  DEFAULTS = 0,
  S3 = 1,
  DATABASE = 2,
  ENVIRONMENT = 3,
}

interface ConfigUpdate {
  source: ConfigSource;
  timestamp: Date;
  changes: Partial<ModelConfiguration>;
}

/**
 * Model configuration manager with hot-reload support
 */
export class ModelConfigManager {
  private config: ModelConfiguration;
  private listeners: Set<(config: ModelConfiguration) => void> = new Set();
  private pollInterval?: ReturnType<typeof setInterval>;

  constructor() {
    this.config = this.buildDefaultConfig();
  }

  /**
   * Get current configuration
   */
  getConfig(): ModelConfiguration {
    return this.config;
  }

  /**
   * Get adapter configuration by ID
   */
  getAdapterConfig(id: string): AdapterConfig | undefined {
    return this.config.adapters.find((a) => a.id === id);
  }

  /**
   * Get agent configuration by type
   */
  getAgentConfig(type: AgentType): AgentConfig | undefined {
    return this.config.agentConfigs[type];
  }

  /**
   * Get fallback chain for an adapter
   */
  getFallbackChain(adapterId: string): string[] {
    return this.config.fallbackChains[adapterId] || [];
  }

  /**
   * Update configuration from a source
   */
  async update(update: ConfigUpdate): Promise<void> {
    logger.info('Updating model configuration', {
      source: ConfigSource[update.source],
      timestamp: update.timestamp,
    });

    // Merge changes based on priority
    const newConfig = this.mergeConfig(this.config, update.changes);

    // Validate new configuration
    this.validateConfig(newConfig);

    // Apply changes
    this.config = newConfig;

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Subscribe to configuration changes
   */
  subscribe(listener: (config: ModelConfiguration) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Start polling for configuration updates
   */
  startPolling(intervalMs = 30000): void {
    if (this.pollInterval) {
      return;
    }

    this.pollInterval = setInterval(async () => {
      await this.checkForUpdates();
    }, intervalMs);

    logger.info('Started configuration polling', { intervalMs });
  }

  /**
   * Stop polling for configuration updates
   */
  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
      logger.info('Stopped configuration polling');
    }
  }

  /**
   * Reload configuration from all sources
   */
  async reload(): Promise<void> {
    logger.info('Reloading configuration');

    // Start with defaults
    let config = this.buildDefaultConfig();

    // Load from each source in order
    // TODO: Implement S3 and database loading

    // Apply environment overrides
    config = this.applyEnvironmentOverrides(config);

    this.config = config;
    this.notifyListeners();
  }

  private buildDefaultConfig(): ModelConfiguration {
    const env = getEnvConfig();

    const adapters: AdapterConfig[] = [
      {
        id: 'anthropic-claude-4-sonnet',
        provider: 'anthropic' as ModelProvider,
        model: 'claude-sonnet-4-5-20250929',
        maxRetries: 3,
        timeoutMs: 60000,
      },
      {
        id: 'anthropic-claude-4-opus',
        provider: 'anthropic' as ModelProvider,
        model: 'claude-opus-4-5-20251101',
        maxRetries: 3,
        timeoutMs: 120000,
      },
      {
        id: 'openai-gpt-4o',
        provider: 'openai' as ModelProvider,
        model: 'gpt-4o',
        maxRetries: 3,
        timeoutMs: 60000,
      },
      {
        id: 'google-gemini-pro',
        provider: 'google' as ModelProvider,
        model: 'gemini-1.5-pro',
        maxRetries: 3,
        timeoutMs: 60000,
      },
    ];

    return {
      adapters,
      defaultAdapterId: 'anthropic-claude-4-sonnet',
      agentConfigs: {},
      fallbackChains: {
        'anthropic-claude-4-sonnet': ['openai-gpt-4o', 'google-gemini-pro'],
        'anthropic-claude-4-opus': ['anthropic-claude-4-sonnet', 'openai-gpt-4o'],
        'openai-gpt-4o': ['anthropic-claude-4-sonnet', 'google-gemini-pro'],
        'google-gemini-pro': ['anthropic-claude-4-sonnet', 'openai-gpt-4o'],
      },
    };
  }

  private applyEnvironmentOverrides(config: ModelConfiguration): ModelConfiguration {
    const env = getEnvConfig();

    // Apply API keys from environment
    for (const adapter of config.adapters) {
      switch (adapter.provider) {
        case 'anthropic':
          adapter.apiKey = env.ANTHROPIC_API_KEY;
          break;
        case 'openai':
          adapter.apiKey = env.OPENAI_API_KEY;
          break;
        case 'google':
          adapter.apiKey = env.GOOGLE_API_KEY;
          break;
      }
    }

    return config;
  }

  private mergeConfig(
    base: ModelConfiguration,
    changes: Partial<ModelConfiguration>
  ): ModelConfiguration {
    return {
      ...base,
      ...changes,
      adapters: changes.adapters || base.adapters,
      agentConfigs: { ...base.agentConfigs, ...changes.agentConfigs },
      fallbackChains: { ...base.fallbackChains, ...changes.fallbackChains },
    };
  }

  private validateConfig(config: ModelConfiguration): void {
    // Check that default adapter exists
    const defaultExists = config.adapters.some(
      (a) => a.id === config.defaultAdapterId
    );
    if (!defaultExists) {
      throw new Error(
        `Default adapter not found: ${config.defaultAdapterId}`
      );
    }

    // Check fallback chains reference valid adapters
    const adapterIds = new Set(config.adapters.map((a) => a.id));
    for (const [adapterId, chain] of Object.entries(config.fallbackChains)) {
      for (const fallbackId of chain) {
        if (!adapterIds.has(fallbackId)) {
          throw new Error(
            `Invalid fallback adapter: ${fallbackId} in chain for ${adapterId}`
          );
        }
      }
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.config);
      } catch (error) {
        logger.error('Error in config listener', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }
  }

  private async checkForUpdates(): Promise<void> {
    // TODO: Check S3 and database for updates
    logger.debug('Checking for configuration updates');
  }
}

// Global instance
let configManager: ModelConfigManager | undefined;

/**
 * Get or create the global configuration manager
 */
export function getModelConfigManager(): ModelConfigManager {
  if (!configManager) {
    configManager = new ModelConfigManager();
  }
  return configManager;
}

/**
 * Initialize the global configuration manager
 */
export function initializeModelConfig(): void {
  configManager = new ModelConfigManager();
}
