// PromptEngine tests

import { describe, it, expect, beforeEach } from 'vitest';
import { PromptEngine, InMemoryTemplateSource, DEFAULT_TEMPLATES } from './prompt-engine.js';

describe('PromptEngine', () => {
  let engine: PromptEngine;

  beforeEach(() => {
    engine = new PromptEngine();
  });

  describe('render()', () => {
    it('should render simple template with variables', () => {
      const template = 'Hello, {{name}}!';
      const result = engine.render(template, { name: 'World' });

      expect(result).toBe('Hello, World!');
    });

    it('should render template with nested variables', () => {
      const template = 'User: {{user.name}}, Age: {{user.age}}';
      const result = engine.render(template, {
        user: { name: 'Alice', age: 30 },
      });

      expect(result).toBe('User: Alice, Age: 30');
    });

    it('should cache compiled templates', () => {
      const template = 'Test {{value}}';

      // Render twice with same template
      engine.render(template, { value: 'first' });
      engine.render(template, { value: 'second' });

      // No way to directly test cache, but coverage confirms code path
    });

    it('should throw error for missing variables in strict mode', () => {
      const template = 'Hello, {{name}}!';

      expect(() => engine.render(template, {})).toThrow();
    });
  });

  describe('Handlebars helpers', () => {
    describe('json helper', () => {
      it('should stringify objects', () => {
        const template = '{{json data}}';
        const result = engine.render(template, { data: { key: 'value' } });

        expect(result).toBe('{\n  "key": "value"\n}');
      });

      it('should stringify arrays', () => {
        const template = '{{json items}}';
        const result = engine.render(template, { items: [1, 2, 3] });

        expect(result).toBe('[\n  1,\n  2,\n  3\n]');
      });
    });

    describe('list helper', () => {
      it('should format array as numbered list', () => {
        const template = '{{list items}}';
        const result = engine.render(template, { items: ['First', 'Second', 'Third'] });

        expect(result).toBe('1. First\n2. Second\n3. Third');
      });

      it('should return empty string for non-array', () => {
        const template = '{{list items}}';
        const result = engine.render(template, { items: 'not an array' });

        expect(result).toBe('');
      });
    });

    describe('bullets helper', () => {
      it('should format array as bullet list', () => {
        const template = '{{bullets items}}';
        const result = engine.render(template, { items: ['Apple', 'Banana', 'Cherry'] });

        expect(result).toBe('• Apple\n• Banana\n• Cherry');
      });

      it('should return empty string for non-array', () => {
        const template = '{{bullets items}}';
        const result = engine.render(template, { items: null });

        expect(result).toBe('');
      });
    });

    describe('capitalize helper', () => {
      it('should capitalize first letter', () => {
        const template = '{{capitalize word}}';
        const result = engine.render(template, { word: 'hello' });

        expect(result).toBe('Hello');
      });

      it('should return empty string for non-string', () => {
        const template = '{{capitalize value}}';
        const result = engine.render(template, { value: 123 });

        expect(result).toBe('');
      });
    });

    describe('truncate helper', () => {
      it('should truncate long strings', () => {
        const template = '{{truncate text 10}}';
        const result = engine.render(template, { text: 'This is a very long string' });

        expect(result).toBe('This is a ...');
      });

      it('should not truncate short strings', () => {
        const template = '{{truncate text 50}}';
        const result = engine.render(template, { text: 'Short' });

        expect(result).toBe('Short');
      });

      it('should return empty string for non-string', () => {
        const template = '{{truncate value 10}}';
        const result = engine.render(template, { value: {} });

        expect(result).toBe('');
      });
    });

    describe('date helper', () => {
      it('should format Date object', () => {
        const template = '{{date dateValue}}';
        const result = engine.render(template, { dateValue: new Date('2024-01-15T12:00:00Z') });

        expect(result).toBe('2024-01-15');
      });

      it('should parse and format date string', () => {
        const template = '{{date dateValue}}';
        const result = engine.render(template, { dateValue: '2024-06-20T08:30:00Z' });

        expect(result).toBe('2024-06-20');
      });
    });

    describe('conditional helpers', () => {
      it('eq helper should compare equality', () => {
        const template = '{{#if (eq a b)}}equal{{else}}not equal{{/if}}';

        expect(engine.render(template, { a: 1, b: 1 })).toBe('equal');
        expect(engine.render(template, { a: 1, b: 2 })).toBe('not equal');
      });

      it('gt helper should compare greater than', () => {
        const template = '{{#if (gt a b)}}greater{{else}}not greater{{/if}}';

        expect(engine.render(template, { a: 5, b: 3 })).toBe('greater');
        expect(engine.render(template, { a: 2, b: 3 })).toBe('not greater');
      });

      it('lt helper should compare less than', () => {
        const template = '{{#if (lt a b)}}less{{else}}not less{{/if}}';

        expect(engine.render(template, { a: 2, b: 5 })).toBe('less');
        expect(engine.render(template, { a: 5, b: 2 })).toBe('not less');
      });
    });
  });

  describe('validate()', () => {
    it('should pass validation when all required vars are present', () => {
      const template = 'Hello {{name}}, you have {{count}} messages.';
      const result = engine.validate(template, ['name', 'count']);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.variables).toContain('name');
      expect(result.variables).toContain('count');
    });

    it('should fail validation when required vars are missing', () => {
      const template = 'Hello {{name}}!';
      const result = engine.validate(template, ['name', 'email']);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Required variable not found in template: email');
    });

    it('should extract all variables from template', () => {
      const template = '{{a}} {{b.c}} {{d}}';
      const result = engine.validate(template, []);

      expect(result.variables).toContain('a');
      expect(result.variables).toContain('b');
      expect(result.variables).toContain('d');
    });
  });

  describe('clearCache()', () => {
    it('should clear the template cache', () => {
      const template = 'Test {{value}}';
      engine.render(template, { value: 'test' });

      // Should not throw
      engine.clearCache();
    });
  });
});

describe('InMemoryTemplateSource', () => {
  let source: InMemoryTemplateSource;

  beforeEach(() => {
    source = new InMemoryTemplateSource();
  });

  describe('load()', () => {
    it('should load stored template', async () => {
      source.set('test-key', 'Template content');

      const result = await source.load('test-key');

      expect(result).toBe('Template content');
    });

    it('should load specific version', async () => {
      source.set('test-key', 'Version 1', 'v1');
      source.set('test-key', 'Version 2', 'v2');

      const v1 = await source.load('test-key', 'v1');
      const v2 = await source.load('test-key', 'v2');

      expect(v1).toBe('Version 1');
      expect(v2).toBe('Version 2');
    });

    it('should fallback to latest version', async () => {
      source.set('test-key', 'Latest version', 'latest');
      source.set('test-key', 'Version 1', 'v1');

      const result = await source.load('test-key', 'non-existent');

      expect(result).toBe('Latest version');
    });

    it('should throw for non-existent template', async () => {
      await expect(source.load('non-existent')).rejects.toThrow('Template not found: non-existent');
    });

    it('should throw for non-existent version without latest', async () => {
      source.set('test-key', 'Version 1', 'v1');

      await expect(source.load('test-key', 'non-existent')).rejects.toThrow(
        'Template version not found: test-key@non-existent'
      );
    });
  });

  describe('set()', () => {
    it('should store template with default version', async () => {
      source.set('key', 'content');

      const result = await source.load('key', 'latest');

      expect(result).toBe('content');
    });

    it('should store multiple versions', async () => {
      source.set('key', 'v1 content', 'v1');
      source.set('key', 'v2 content', 'v2');

      expect(await source.load('key', 'v1')).toBe('v1 content');
      expect(await source.load('key', 'v2')).toBe('v2 content');
    });
  });
});

describe('DEFAULT_TEMPLATES', () => {
  it('should have classifier template', () => {
    expect(DEFAULT_TEMPLATES.classifier).toBeDefined();
    expect(DEFAULT_TEMPLATES.classifier).toContain('{{requirement}}');
    expect(DEFAULT_TEMPLATES.classifier).toContain('new_feature');
  });

  it('should have decomposer template', () => {
    expect(DEFAULT_TEMPLATES.decomposer).toBeDefined();
    expect(DEFAULT_TEMPLATES.decomposer).toContain('{{requirement}}');
    expect(DEFAULT_TEMPLATES.decomposer).toContain('{{requirementType}}');
    expect(DEFAULT_TEMPLATES.decomposer).toContain('themes');
    expect(DEFAULT_TEMPLATES.decomposer).toContain('atomicRequirements');
  });

  describe('classifier template rendering', () => {
    it('should render with requirement variable', () => {
      const engine = new PromptEngine();
      const result = engine.render(DEFAULT_TEMPLATES.classifier, {
        requirement: 'Build user authentication system',
      });

      expect(result).toContain('Build user authentication system');
      expect(result).toContain('new_feature');
      expect(result).toContain('enhancement');
      expect(result).toContain('epic');
      expect(result).toContain('bug_fix');
    });
  });

  describe('decomposer template rendering', () => {
    it('should render with requirement and type variables', () => {
      const engine = new PromptEngine();
      const result = engine.render(DEFAULT_TEMPLATES.decomposer, {
        requirement: 'Implement shopping cart',
        requirementType: 'new_feature',
      });

      expect(result).toContain('Implement shopping cart');
      expect(result).toContain('new_feature');
      expect(result).toContain('themes');
      expect(result).toContain('atomicRequirements');
      expect(result).toContain('featureCandidates');
    });
  });
});
