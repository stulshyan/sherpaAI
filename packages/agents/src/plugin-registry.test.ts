// PluginRegistry tests

import type { AgentInput, AgentOutput, AgentPlugin } from '@entropy/shared';
import { AgentType } from '@entropy/shared';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PluginRegistry,
  PluginError,
  getPluginRegistry,
  initializePluginRegistry,
  createPreProcessor,
  createPostProcessor,
  createPlugin,
} from './plugin-registry.js';

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  const createMockPlugin = (name: string): AgentPlugin => ({
    name,
    preProcessors: [
      {
        name: `${name}-pre`,
        priority: 10,
        process: async (input) => input,
      },
    ],
    postProcessors: [
      {
        name: `${name}-post`,
        priority: 10,
        process: async (output) => output,
      },
    ],
  });

  describe('register()', () => {
    it('should register a plugin', () => {
      const plugin = createMockPlugin('test-plugin');

      registry.register(plugin);

      expect(registry.has('test-plugin')).toBe(true);
    });

    it('should replace existing plugin with same name', () => {
      const plugin1 = createMockPlugin('test-plugin');
      const plugin2 = createMockPlugin('test-plugin');
      plugin2.preProcessors = [];

      registry.register(plugin1);
      registry.register(plugin2);

      expect(registry.get('test-plugin')?.preProcessors).toEqual([]);
    });

    it('should register multiple plugins', () => {
      registry.register(createMockPlugin('plugin-1'));
      registry.register(createMockPlugin('plugin-2'));
      registry.register(createMockPlugin('plugin-3'));

      expect(registry.list()).toHaveLength(3);
    });
  });

  describe('unregister()', () => {
    it('should remove a registered plugin', () => {
      registry.register(createMockPlugin('test-plugin'));

      const removed = registry.unregister('test-plugin');

      expect(removed).toBe(true);
      expect(registry.has('test-plugin')).toBe(false);
    });

    it('should return false for non-existent plugin', () => {
      const removed = registry.unregister('non-existent');

      expect(removed).toBe(false);
    });
  });

  describe('has()', () => {
    it('should return true for registered plugin', () => {
      registry.register(createMockPlugin('test-plugin'));

      expect(registry.has('test-plugin')).toBe(true);
    });

    it('should return false for non-registered plugin', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('get()', () => {
    it('should return registered plugin', () => {
      const plugin = createMockPlugin('test-plugin');
      registry.register(plugin);

      const retrieved = registry.get('test-plugin');

      expect(retrieved).toEqual(plugin);
    });

    it('should return undefined for non-registered plugin', () => {
      expect(registry.get('non-existent')).toBeUndefined();
    });
  });

  describe('list()', () => {
    it('should return all registered plugins', () => {
      registry.register(createMockPlugin('plugin-1'));
      registry.register(createMockPlugin('plugin-2'));

      const plugins = registry.list();

      expect(plugins).toHaveLength(2);
      expect(plugins.map((p) => p.name)).toContain('plugin-1');
      expect(plugins.map((p) => p.name)).toContain('plugin-2');
    });

    it('should return empty array when no plugins', () => {
      expect(registry.list()).toEqual([]);
    });
  });

  describe('applyPreProcessors()', () => {
    const mockInput: AgentInput = {
      type: AgentType.CLASSIFIER,
      data: { value: 'original' },
    };

    it('should apply pre-processors in priority order', async () => {
      const order: number[] = [];

      registry.register({
        name: 'low-priority',
        preProcessors: [
          {
            name: 'low',
            priority: 1,
            process: async (input) => {
              order.push(1);
              return input;
            },
          },
        ],
      });

      registry.register({
        name: 'high-priority',
        preProcessors: [
          {
            name: 'high',
            priority: 100,
            process: async (input) => {
              order.push(100);
              return input;
            },
          },
        ],
      });

      await registry.applyPreProcessors(mockInput);

      // Higher priority should run first
      expect(order).toEqual([100, 1]);
    });

    it('should transform input through processors', async () => {
      registry.register({
        name: 'transformer',
        preProcessors: [
          {
            name: 'add-field',
            priority: 10,
            process: async (input) => ({
              ...input,
              data: { ...input.data, added: true },
            }),
          },
        ],
      });

      const result = await registry.applyPreProcessors(mockInput);

      expect(result.data).toEqual({ value: 'original', added: true });
    });

    it('should chain multiple processors', async () => {
      registry.register({
        name: 'plugin-1',
        preProcessors: [
          {
            name: 'first',
            priority: 20,
            process: async (input) => ({
              ...input,
              data: { ...input.data, first: true },
            }),
          },
        ],
      });

      registry.register({
        name: 'plugin-2',
        preProcessors: [
          {
            name: 'second',
            priority: 10,
            process: async (input) => ({
              ...input,
              data: { ...input.data, second: true },
            }),
          },
        ],
      });

      const result = await registry.applyPreProcessors(mockInput);

      expect(result.data).toEqual({
        value: 'original',
        first: true,
        second: true,
      });
    });

    it('should throw PluginError on processor failure', async () => {
      registry.register({
        name: 'failing-plugin',
        preProcessors: [
          {
            name: 'fail',
            priority: 10,
            process: async () => {
              throw new Error('Processor failed');
            },
          },
        ],
      });

      await expect(registry.applyPreProcessors(mockInput)).rejects.toThrow(PluginError);
    });
  });

  describe('applyPostProcessors()', () => {
    const mockOutput: AgentOutput = {
      type: AgentType.CLASSIFIER,
      data: { result: 'original' },
      quality: { overall: 0.8, completeness: 0.8, consistency: 0.8, confidence: 0.8 },
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      model: 'test-model',
      latencyMs: 500,
    };

    it('should apply post-processors in priority order', async () => {
      const order: number[] = [];

      registry.register({
        name: 'low-priority',
        postProcessors: [
          {
            name: 'low',
            priority: 1,
            process: async (output) => {
              order.push(1);
              return output;
            },
          },
        ],
      });

      registry.register({
        name: 'high-priority',
        postProcessors: [
          {
            name: 'high',
            priority: 100,
            process: async (output) => {
              order.push(100);
              return output;
            },
          },
        ],
      });

      await registry.applyPostProcessors(mockOutput);

      expect(order).toEqual([100, 1]);
    });

    it('should transform output through processors', async () => {
      registry.register({
        name: 'transformer',
        postProcessors: [
          {
            name: 'enrich',
            priority: 10,
            process: async (output) => ({
              ...output,
              data: { ...output.data, enriched: true },
            }),
          },
        ],
      });

      const result = await registry.applyPostProcessors(mockOutput);

      expect(result.data).toEqual({ result: 'original', enriched: true });
    });

    it('should throw PluginError on processor failure', async () => {
      registry.register({
        name: 'failing-plugin',
        postProcessors: [
          {
            name: 'fail',
            priority: 10,
            process: async () => {
              throw new Error('Processor failed');
            },
          },
        ],
      });

      await expect(registry.applyPostProcessors(mockOutput)).rejects.toThrow(PluginError);
    });
  });

  describe('clear()', () => {
    it('should remove all plugins', () => {
      registry.register(createMockPlugin('plugin-1'));
      registry.register(createMockPlugin('plugin-2'));

      registry.clear();

      expect(registry.list()).toHaveLength(0);
    });
  });
});

describe('PluginError', () => {
  it('should include plugin name and processor type', () => {
    const error = new PluginError('Test error', 'test-plugin', 'pre');

    expect(error.message).toBe('Test error');
    expect(error.pluginName).toBe('test-plugin');
    expect(error.processorType).toBe('pre');
    expect(error.name).toBe('PluginError');
  });
});

describe('Global registry functions', () => {
  beforeEach(() => {
    // Clear global registry before each test
    getPluginRegistry().clear();
  });

  describe('getPluginRegistry()', () => {
    it('should return singleton instance', () => {
      const registry1 = getPluginRegistry();
      const registry2 = getPluginRegistry();

      expect(registry1).toBe(registry2);
    });
  });

  describe('initializePluginRegistry()', () => {
    it('should initialize with plugins', () => {
      const plugins = [{ name: 'plugin-1' }, { name: 'plugin-2' }];

      initializePluginRegistry(plugins);

      const registry = getPluginRegistry();
      expect(registry.has('plugin-1')).toBe(true);
      expect(registry.has('plugin-2')).toBe(true);
    });

    it('should clear existing plugins on initialization', () => {
      const registry = getPluginRegistry();
      registry.register({ name: 'existing' });

      initializePluginRegistry([{ name: 'new' }]);

      expect(registry.has('existing')).toBe(false);
      expect(registry.has('new')).toBe(true);
    });
  });
});

describe('Helper functions', () => {
  describe('createPreProcessor()', () => {
    it('should create pre-processor with correct structure', () => {
      const processFn = vi.fn(async (input: AgentInput) => input);

      const processor = createPreProcessor('test-pre', 10, processFn);

      expect(processor.name).toBe('test-pre');
      expect(processor.priority).toBe(10);
      expect(processor.process).toBe(processFn);
    });
  });

  describe('createPostProcessor()', () => {
    it('should create post-processor with correct structure', () => {
      const processFn = vi.fn(async (output: AgentOutput) => output);

      const processor = createPostProcessor('test-post', 20, processFn);

      expect(processor.name).toBe('test-post');
      expect(processor.priority).toBe(20);
      expect(processor.process).toBe(processFn);
    });
  });

  describe('createPlugin()', () => {
    it('should create plugin with processors', () => {
      const pre = createPreProcessor('pre', 10, async (input) => input);
      const post = createPostProcessor('post', 10, async (output) => output);

      const plugin = createPlugin('test-plugin', {
        preProcessors: [pre],
        postProcessors: [post],
      });

      expect(plugin.name).toBe('test-plugin');
      expect(plugin.preProcessors).toEqual([pre]);
      expect(plugin.postProcessors).toEqual([post]);
    });

    it('should create plugin without processors', () => {
      const plugin = createPlugin('empty-plugin', {});

      expect(plugin.name).toBe('empty-plugin');
      expect(plugin.preProcessors).toBeUndefined();
      expect(plugin.postProcessors).toBeUndefined();
    });
  });
});
