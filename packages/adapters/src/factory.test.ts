// Adapter factory tests

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdapterFactory, createAdapter } from './factory.js';
import type { AdapterConfig, ModelProvider } from '@entropy/shared';
import { AnthropicAdapter } from './anthropic.js';
import { OpenAIAdapter } from './openai.js';
import { GoogleAdapter } from './google.js';

// Mock all adapters
vi.mock('./anthropic.js', () => ({
  AnthropicAdapter: vi.fn().mockImplementation((config) => ({
    id: config.id,
    provider: 'anthropic',
    complete: vi.fn(),
    stream: vi.fn(),
    countTokens: vi.fn(),
    estimateCost: vi.fn(),
    healthCheck: vi.fn(),
  })),
}));

vi.mock('./openai.js', () => ({
  OpenAIAdapter: vi.fn().mockImplementation((config) => ({
    id: config.id,
    provider: 'openai',
    complete: vi.fn(),
    stream: vi.fn(),
    countTokens: vi.fn(),
    estimateCost: vi.fn(),
    healthCheck: vi.fn(),
  })),
}));

vi.mock('./google.js', () => ({
  GoogleAdapter: vi.fn().mockImplementation((config) => ({
    id: config.id,
    provider: 'google',
    complete: vi.fn(),
    stream: vi.fn(),
    countTokens: vi.fn(),
    estimateCost: vi.fn(),
    healthCheck: vi.fn(),
  })),
}));

describe('AdapterFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('create()', () => {
    it('should create an Anthropic adapter for anthropic provider', () => {
      const config: AdapterConfig = {
        id: 'test-anthropic',
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
        apiKey: 'test-key',
      };

      const adapter = AdapterFactory.create(config);

      expect(AnthropicAdapter).toHaveBeenCalledWith(config);
      expect(adapter.provider).toBe('anthropic');
      expect(adapter.id).toBe('test-anthropic');
    });

    it('should create an OpenAI adapter for openai provider', () => {
      const config: AdapterConfig = {
        id: 'test-openai',
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'test-key',
      };

      const adapter = AdapterFactory.create(config);

      expect(OpenAIAdapter).toHaveBeenCalledWith(config);
      expect(adapter.provider).toBe('openai');
      expect(adapter.id).toBe('test-openai');
    });

    it('should create a Google adapter for google provider', () => {
      const config: AdapterConfig = {
        id: 'test-google',
        provider: 'google',
        model: 'gemini-1.5-pro',
        apiKey: 'test-key',
      };

      const adapter = AdapterFactory.create(config);

      expect(GoogleAdapter).toHaveBeenCalledWith(config);
      expect(adapter.provider).toBe('google');
      expect(adapter.id).toBe('test-google');
    });

    it('should throw error for unknown provider', () => {
      const config: AdapterConfig = {
        id: 'test-unknown',
        provider: 'unknown' as ModelProvider,
        model: 'some-model',
      };

      expect(() => AdapterFactory.create(config)).toThrow('Unknown adapter provider: unknown');
    });

    it('should pass all config options to adapter constructor', () => {
      const config: AdapterConfig = {
        id: 'full-config',
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
        apiKey: 'test-key',
        baseUrl: 'https://custom.api.com',
        maxRetries: 5,
        timeoutMs: 30000,
        rateLimit: {
          requestsPerMinute: 100,
          tokensPerMinute: 100000,
        },
      };

      AdapterFactory.create(config);

      expect(AnthropicAdapter).toHaveBeenCalledWith(config);
    });
  });

  describe('register()', () => {
    it('should allow registering custom adapter classes', () => {
      const CustomAdapter = vi.fn().mockImplementation((config) => ({
        id: config.id,
        provider: 'anthropic',
        complete: vi.fn(),
        stream: vi.fn(),
        countTokens: vi.fn(),
        estimateCost: vi.fn(),
        healthCheck: vi.fn(),
      }));

      // Register custom adapter for anthropic (overrides default)
      AdapterFactory.register('anthropic', CustomAdapter as unknown as typeof AnthropicAdapter);

      const config: AdapterConfig = {
        id: 'custom-anthropic',
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
      };

      AdapterFactory.create(config);

      expect(CustomAdapter).toHaveBeenCalledWith(config);
    });
  });

  describe('has()', () => {
    it('should return true for registered providers', () => {
      expect(AdapterFactory.has('anthropic')).toBe(true);
      expect(AdapterFactory.has('openai')).toBe(true);
      expect(AdapterFactory.has('google')).toBe(true);
    });

    it('should return false for unregistered providers', () => {
      expect(AdapterFactory.has('unknown' as ModelProvider)).toBe(false);
    });
  });

  describe('getProviders()', () => {
    it('should return all registered providers', () => {
      const providers = AdapterFactory.getProviders();

      expect(providers).toContain('anthropic');
      expect(providers).toContain('openai');
      expect(providers).toContain('google');
    });
  });
});

describe('createAdapter()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create adapter with minimal configuration', () => {
    const adapter = createAdapter('anthropic', 'claude-sonnet-4-5-20250929');

    expect(AnthropicAdapter).toHaveBeenCalledWith({
      id: 'anthropic-claude-sonnet-4-5-20250929',
      provider: 'anthropic',
      model: 'claude-sonnet-4-5-20250929',
      apiKey: undefined,
    });
    expect(adapter).toBeDefined();
  });

  it('should create adapter with API key', () => {
    const adapter = createAdapter('openai', 'gpt-4o', 'sk-test-key');

    expect(OpenAIAdapter).toHaveBeenCalledWith({
      id: 'openai-gpt-4o',
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'sk-test-key',
    });
    expect(adapter).toBeDefined();
  });

  it('should generate consistent id format', () => {
    const adapter = createAdapter('google', 'gemini-1.5-pro');

    expect(GoogleAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'google-gemini-1.5-pro',
      })
    );
    expect(adapter).toBeDefined();
  });
});
