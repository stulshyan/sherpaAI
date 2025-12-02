// Adapter factory for creating model adapters

import type { ModelAdapter, AdapterConfig, ModelProvider } from '@entropy/shared';
import { AnthropicAdapter } from './anthropic.js';
import { OpenAIAdapter } from './openai.js';
import { GoogleAdapter } from './google.js';

type AdapterConstructor = new (config: AdapterConfig) => ModelAdapter;

const adapterRegistry: Map<ModelProvider, AdapterConstructor> = new Map([
  ['anthropic', AnthropicAdapter],
  ['openai', OpenAIAdapter],
  ['google', GoogleAdapter],
]);

/**
 * Factory for creating model adapters
 */
export class AdapterFactory {
  /**
   * Create an adapter instance from configuration
   */
  static create(config: AdapterConfig): ModelAdapter {
    const AdapterClass = adapterRegistry.get(config.provider);

    if (!AdapterClass) {
      throw new Error(`Unknown adapter provider: ${config.provider}`);
    }

    return new AdapterClass(config);
  }

  /**
   * Register a custom adapter class
   */
  static register(provider: ModelProvider, AdapterClass: AdapterConstructor): void {
    adapterRegistry.set(provider, AdapterClass);
  }

  /**
   * Check if an adapter is registered for the given provider
   */
  static has(provider: ModelProvider): boolean {
    return adapterRegistry.has(provider);
  }

  /**
   * Get all registered providers
   */
  static getProviders(): ModelProvider[] {
    return Array.from(adapterRegistry.keys());
  }
}

/**
 * Create an adapter with minimal configuration
 */
export function createAdapter(
  provider: ModelProvider,
  model: string,
  apiKey?: string
): ModelAdapter {
  return AdapterFactory.create({
    id: `${provider}-${model}`,
    provider,
    model,
    apiKey,
  });
}
