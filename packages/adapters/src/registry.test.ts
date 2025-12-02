// Adapter registry tests

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AdapterRegistry,
  getAdapterRegistry,
  initializeAdapterRegistry,
  RegistryConfig,
} from './registry.js';
import type { AdapterConfig, ModelAdapter } from '@entropy/shared';

// Mock the factory
vi.mock('./factory.js', () => ({
  AdapterFactory: {
    create: vi.fn((config: AdapterConfig) => ({
      id: config.id,
      provider: config.provider,
      complete: vi.fn().mockResolvedValue({ content: 'test', requestId: 'req-123' }),
      stream: vi.fn(),
      countTokens: vi.fn().mockReturnValue(10),
      estimateCost: vi.fn().mockReturnValue(0.001),
      healthCheck: vi.fn().mockResolvedValue(true),
    })),
  },
}));

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;
  const defaultConfig: RegistryConfig = {
    adapters: [
      {
        id: 'anthropic-sonnet',
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
        apiKey: 'test-key',
      },
      {
        id: 'openai-gpt4o',
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'test-key',
      },
      {
        id: 'google-gemini',
        provider: 'google',
        model: 'gemini-1.5-pro',
        apiKey: 'test-key',
      },
    ],
    defaultAdapterId: 'anthropic-sonnet',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new AdapterRegistry(defaultConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      expect(registry.list()).toHaveLength(3);
    });

    it('should work without config', () => {
      const emptyRegistry = new AdapterRegistry();
      expect(emptyRegistry.list()).toHaveLength(0);
    });
  });

  describe('initialize()', () => {
    it('should set up adapters from configuration', () => {
      const newRegistry = new AdapterRegistry();
      newRegistry.initialize(defaultConfig);

      expect(newRegistry.list()).toHaveLength(3);
      expect(newRegistry.has('anthropic-sonnet')).toBe(true);
      expect(newRegistry.has('openai-gpt4o')).toBe(true);
      expect(newRegistry.has('google-gemini')).toBe(true);
    });

    it('should use first adapter as default if not specified', () => {
      const configWithoutDefault: RegistryConfig = {
        adapters: defaultConfig.adapters,
      };

      const newRegistry = new AdapterRegistry(configWithoutDefault);
      const defaultAdapter = newRegistry.getDefault();

      expect(defaultAdapter.id).toBe('anthropic-sonnet');
    });

    it('should clear existing adapters on re-initialize', () => {
      registry.get('anthropic-sonnet'); // Create cached adapter

      const newConfig: RegistryConfig = {
        adapters: [
          {
            id: 'new-adapter',
            provider: 'anthropic',
            model: 'claude-opus-4-5-20251101',
          },
        ],
      };

      registry.initialize(newConfig);

      expect(registry.has('anthropic-sonnet')).toBe(false);
      expect(registry.has('new-adapter')).toBe(true);
    });
  });

  describe('get()', () => {
    it('should return adapter by ID', () => {
      const adapter = registry.get('anthropic-sonnet');

      expect(adapter).toBeDefined();
      expect(adapter.id).toBe('anthropic-sonnet');
      expect(adapter.provider).toBe('anthropic');
    });

    it('should lazy-load adapters on first access', async () => {
      const { AdapterFactory } = await import('./factory.js');

      // Get adapter for first time
      registry.get('anthropic-sonnet');

      expect(AdapterFactory.create).toHaveBeenCalledTimes(1);

      // Get same adapter again - should use cache
      registry.get('anthropic-sonnet');

      expect(AdapterFactory.create).toHaveBeenCalledTimes(1);
    });

    it('should throw error for non-existent adapter', () => {
      expect(() => registry.get('non-existent')).toThrow('Adapter not found: non-existent');
    });
  });

  describe('getDefault()', () => {
    it('should return the default adapter', () => {
      const adapter = registry.getDefault();

      expect(adapter.id).toBe('anthropic-sonnet');
    });

    it('should throw error if no default configured', () => {
      const emptyRegistry = new AdapterRegistry();

      expect(() => emptyRegistry.getDefault()).toThrow('No default adapter configured');
    });
  });

  describe('has()', () => {
    it('should return true for existing adapter', () => {
      expect(registry.has('anthropic-sonnet')).toBe(true);
    });

    it('should return false for non-existing adapter', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('list()', () => {
    it('should return all configured adapters', () => {
      const adapters = registry.list();

      expect(adapters).toHaveLength(3);
      expect(adapters.map((a) => a.id)).toEqual([
        'anthropic-sonnet',
        'openai-gpt4o',
        'google-gemini',
      ]);
    });
  });

  describe('reload()', () => {
    it('should reload configuration and clear cached adapters', async () => {
      // Access adapter to cache it
      registry.get('anthropic-sonnet');

      const newConfig: RegistryConfig = {
        adapters: [
          {
            id: 'reloaded-adapter',
            provider: 'openai',
            model: 'gpt-4o-mini',
          },
        ],
      };

      await registry.reload(newConfig);

      expect(registry.has('anthropic-sonnet')).toBe(false);
      expect(registry.has('reloaded-adapter')).toBe(true);
    });

    it('should run health checks on existing adapters before reload', async () => {
      // Access adapter to cache it
      const adapter = registry.get('anthropic-sonnet');

      await registry.reload(defaultConfig);

      expect(adapter.healthCheck).toHaveBeenCalled();
    });
  });

  describe('healthCheck()', () => {
    it('should return health status for all adapters', async () => {
      const results = await registry.healthCheck();

      expect(results.size).toBe(3);
      expect(results.get('anthropic-sonnet')).toBe(true);
      expect(results.get('openai-gpt4o')).toBe(true);
      expect(results.get('google-gemini')).toBe(true);
    });

    it('should return false for unhealthy adapters', async () => {
      const { AdapterFactory } = await import('./factory.js');
      vi.mocked(AdapterFactory.create).mockImplementation(
        (config: AdapterConfig) =>
          ({
            id: config.id,
            provider: config.provider,
            healthCheck: vi.fn().mockResolvedValue(config.id !== 'openai-gpt4o'),
          }) as unknown as ModelAdapter
      );

      const newRegistry = new AdapterRegistry(defaultConfig);
      const results = await newRegistry.healthCheck();

      expect(results.get('anthropic-sonnet')).toBe(true);
      expect(results.get('openai-gpt4o')).toBe(false);
    });

    it('should handle errors during health check', async () => {
      const { AdapterFactory } = await import('./factory.js');
      vi.mocked(AdapterFactory.create).mockImplementation(
        (config: AdapterConfig) =>
          ({
            id: config.id,
            provider: config.provider,
            healthCheck: vi.fn().mockRejectedValue(new Error('Health check failed')),
          }) as unknown as ModelAdapter
      );

      const newRegistry = new AdapterRegistry(defaultConfig);
      const results = await newRegistry.healthCheck();

      expect(results.get('anthropic-sonnet')).toBe(false);
    });
  });

  describe('getConfig()', () => {
    it('should return adapter configuration by ID', () => {
      const config = registry.getConfig('anthropic-sonnet');

      expect(config).toBeDefined();
      expect(config?.id).toBe('anthropic-sonnet');
      expect(config?.model).toBe('claude-sonnet-4-5-20250929');
    });

    it('should return undefined for non-existent adapter', () => {
      const config = registry.getConfig('non-existent');

      expect(config).toBeUndefined();
    });
  });

  describe('updateConfig()', () => {
    it('should update adapter configuration', () => {
      registry.updateConfig('anthropic-sonnet', {
        model: 'claude-opus-4-5-20251101',
        timeoutMs: 120000,
      });

      const config = registry.getConfig('anthropic-sonnet');

      expect(config?.model).toBe('claude-opus-4-5-20251101');
      expect(config?.timeoutMs).toBe(120000);
    });

    it('should clear cached adapter instance after update', async () => {
      const { AdapterFactory } = await import('./factory.js');

      // Access adapter to cache it
      registry.get('anthropic-sonnet');

      // Update config
      registry.updateConfig('anthropic-sonnet', { model: 'claude-opus-4-5-20251101' });

      // Access again - should create new instance
      registry.get('anthropic-sonnet');

      expect(AdapterFactory.create).toHaveBeenCalledTimes(2);
    });

    it('should throw error for non-existent adapter', () => {
      expect(() => registry.updateConfig('non-existent', { model: 'new-model' })).toThrow(
        'Adapter not found: non-existent'
      );
    });
  });
});

describe('Global registry functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAdapterRegistry()', () => {
    it('should return a singleton registry instance', () => {
      const registry1 = getAdapterRegistry();
      const registry2 = getAdapterRegistry();

      expect(registry1).toBe(registry2);
    });

    it('should create registry if not exists', () => {
      const registry = getAdapterRegistry();

      expect(registry).toBeInstanceOf(AdapterRegistry);
    });
  });

  describe('initializeAdapterRegistry()', () => {
    it('should initialize the global registry with config', () => {
      const config: RegistryConfig = {
        adapters: [
          {
            id: 'global-adapter',
            provider: 'anthropic',
            model: 'claude-sonnet-4-5-20250929',
          },
        ],
      };

      initializeAdapterRegistry(config);
      const registry = getAdapterRegistry();

      expect(registry.has('global-adapter')).toBe(true);
    });
  });
});
