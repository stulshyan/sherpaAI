// Plugin registry for agent extensibility

import type {
  AgentPlugin,
  PreProcessor,
  PostProcessor,
  AgentInput,
  AgentOutput,
} from '@entropy/shared';
import { createLogger } from '@entropy/shared';

const logger = createLogger('plugin-registry');

/**
 * Registry for managing agent plugins
 */
export class PluginRegistry {
  private plugins: Map<string, AgentPlugin> = new Map();
  private preProcessors: PreProcessor[] = [];
  private postProcessors: PostProcessor[] = [];

  /**
   * Register a plugin
   */
  register(plugin: AgentPlugin): void {
    if (this.plugins.has(plugin.name)) {
      logger.warn('Plugin already registered, replacing', { name: plugin.name });
    }

    this.plugins.set(plugin.name, plugin);

    // Re-sort processors after registration
    this.rebuildProcessorLists();

    logger.info('Plugin registered', {
      name: plugin.name,
      preProcessors: plugin.preProcessors?.length ?? 0,
      postProcessors: plugin.postProcessors?.length ?? 0,
    });
  }

  /**
   * Unregister a plugin by name
   */
  unregister(name: string): boolean {
    const removed = this.plugins.delete(name);

    if (removed) {
      this.rebuildProcessorLists();
      logger.info('Plugin unregistered', { name });
    }

    return removed;
  }

  /**
   * Check if a plugin is registered
   */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Get a plugin by name
   */
  get(name: string): AgentPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * List all registered plugins
   */
  list(): AgentPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Apply all pre-processors to input
   */
  async applyPreProcessors(input: AgentInput): Promise<AgentInput> {
    let processedInput = input;

    for (const processor of this.preProcessors) {
      try {
        logger.debug('Applying pre-processor', { name: processor.name });
        processedInput = await processor.process(processedInput);
      } catch (error) {
        logger.error('Pre-processor failed', {
          name: processor.name,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new PluginError(
          `Pre-processor "${processor.name}" failed: ${error instanceof Error ? error.message : String(error)}`,
          processor.name,
          'pre'
        );
      }
    }

    return processedInput;
  }

  /**
   * Apply all post-processors to output
   */
  async applyPostProcessors(output: AgentOutput): Promise<AgentOutput> {
    let processedOutput = output;

    for (const processor of this.postProcessors) {
      try {
        logger.debug('Applying post-processor', { name: processor.name });
        processedOutput = await processor.process(processedOutput);
      } catch (error) {
        logger.error('Post-processor failed', {
          name: processor.name,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new PluginError(
          `Post-processor "${processor.name}" failed: ${error instanceof Error ? error.message : String(error)}`,
          processor.name,
          'post'
        );
      }
    }

    return processedOutput;
  }

  /**
   * Clear all plugins
   */
  clear(): void {
    this.plugins.clear();
    this.preProcessors = [];
    this.postProcessors = [];
    logger.info('All plugins cleared');
  }

  /**
   * Rebuild sorted processor lists from all plugins
   */
  private rebuildProcessorLists(): void {
    const preProcessors: PreProcessor[] = [];
    const postProcessors: PostProcessor[] = [];

    for (const plugin of this.plugins.values()) {
      if (plugin.preProcessors) {
        preProcessors.push(...plugin.preProcessors);
      }
      if (plugin.postProcessors) {
        postProcessors.push(...plugin.postProcessors);
      }
    }

    // Sort by priority (higher priority first)
    this.preProcessors = preProcessors.sort((a, b) => b.priority - a.priority);
    this.postProcessors = postProcessors.sort((a, b) => b.priority - a.priority);
  }
}

/**
 * Error thrown when a plugin fails
 */
export class PluginError extends Error {
  readonly pluginName: string;
  readonly processorType: 'pre' | 'post';

  constructor(message: string, pluginName: string, processorType: 'pre' | 'post') {
    super(message);
    this.name = 'PluginError';
    this.pluginName = pluginName;
    this.processorType = processorType;
  }
}

// Global plugin registry singleton
let globalRegistry: PluginRegistry | undefined;

/**
 * Get the global plugin registry
 */
export function getPluginRegistry(): PluginRegistry {
  if (!globalRegistry) {
    globalRegistry = new PluginRegistry();
  }
  return globalRegistry;
}

/**
 * Initialize the global plugin registry with plugins
 */
export function initializePluginRegistry(plugins: AgentPlugin[]): void {
  const registry = getPluginRegistry();
  registry.clear();

  for (const plugin of plugins) {
    registry.register(plugin);
  }
}

/**
 * Create a simple pre-processor
 */
export function createPreProcessor(
  name: string,
  priority: number,
  processFn: (input: AgentInput) => Promise<AgentInput>
): PreProcessor {
  return {
    name,
    priority,
    process: processFn,
  };
}

/**
 * Create a simple post-processor
 */
export function createPostProcessor(
  name: string,
  priority: number,
  processFn: (output: AgentOutput) => Promise<AgentOutput>
): PostProcessor {
  return {
    name,
    priority,
    process: processFn,
  };
}

/**
 * Create a plugin from pre-processors and post-processors
 */
export function createPlugin(
  name: string,
  options: {
    preProcessors?: PreProcessor[];
    postProcessors?: PostProcessor[];
  }
): AgentPlugin {
  return {
    name,
    preProcessors: options.preProcessors,
    postProcessors: options.postProcessors,
  };
}
