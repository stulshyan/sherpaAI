// Prompt template engine

import { createLogger } from '@entropy/shared';
import Handlebars from 'handlebars';

const logger = createLogger('prompt-engine');

// In-memory cache for templates
const templateCache = new Map<string, HandlebarsTemplateDelegate>();

export interface TemplateSource {
  load(key: string, version?: string): Promise<string>;
}

/**
 * In-memory template source for testing
 */
export class InMemoryTemplateSource implements TemplateSource {
  private templates = new Map<string, Map<string, string>>();

  async load(key: string, version = 'latest'): Promise<string> {
    const versions = this.templates.get(key);
    if (!versions) {
      throw new Error(`Template not found: ${key}`);
    }

    const template = versions.get(version) || versions.get('latest');
    if (!template) {
      throw new Error(`Template version not found: ${key}@${version}`);
    }

    return template;
  }

  set(key: string, template: string, version = 'latest'): void {
    let versions = this.templates.get(key);
    if (!versions) {
      versions = new Map();
      this.templates.set(key, versions);
    }
    versions.set(version, template);
  }
}

/**
 * Prompt template engine with caching and validation
 */
export class PromptEngine {
  private source: TemplateSource;

  constructor(source?: TemplateSource) {
    this.source = source || new InMemoryTemplateSource();
    this.registerHelpers();
  }

  /**
   * Load a template from the source
   */
  async load(templateKey: string, version?: string): Promise<string> {
    logger.debug('Loading template', { templateKey, version });
    return this.source.load(templateKey, version);
  }

  /**
   * Render a template with variables
   */
  render(template: string, variables: Record<string, unknown>): string {
    const cacheKey = this.hash(template);
    let compiled = templateCache.get(cacheKey);

    if (!compiled) {
      compiled = Handlebars.compile(template, { strict: true });
      templateCache.set(cacheKey, compiled);
    }

    return compiled(variables);
  }

  /**
   * Load and render a template in one step
   */
  async loadAndRender(
    templateKey: string,
    variables: Record<string, unknown>,
    version?: string
  ): Promise<string> {
    const template = await this.load(templateKey, version);
    return this.render(template, variables);
  }

  /**
   * Validate that all required variables are present
   */
  validate(template: string, requiredVars: string[]): TemplateValidationResult {
    const errors: string[] = [];

    // Find all variable references in template
    const varPattern = /\{\{([^}]+)\}\}/g;
    const matches = [...template.matchAll(varPattern)];
    const templateVars = new Set(
      matches.map((m) => m[1]!.trim().split(/[.\s]/)[0]).filter((v): v is string => v !== undefined)
    );

    // Check if required vars are referenced
    for (const varName of requiredVars) {
      if (!templateVars.has(varName)) {
        errors.push(`Required variable not found in template: ${varName}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      variables: Array.from(templateVars),
    };
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerHelpers(): void {
    // JSON stringify helper
    Handlebars.registerHelper('json', (context) => {
      return JSON.stringify(context, null, 2);
    });

    // List formatting helper
    Handlebars.registerHelper('list', (items: string[]) => {
      if (!Array.isArray(items)) return '';
      return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
    });

    // Bullet list helper
    Handlebars.registerHelper('bullets', (items: string[]) => {
      if (!Array.isArray(items)) return '';
      return items.map((item) => `• ${item}`).join('\n');
    });

    // Capitalize helper
    Handlebars.registerHelper('capitalize', (str: string) => {
      if (typeof str !== 'string') return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    // Truncate helper
    Handlebars.registerHelper('truncate', (str: string, length: number) => {
      if (typeof str !== 'string') return '';
      if (str.length <= length) return str;
      return str.slice(0, length) + '...';
    });

    // Date formatting helper
    Handlebars.registerHelper('date', (date: Date | string) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toISOString().split('T')[0];
    });

    // Conditional equals helper
    Handlebars.registerHelper('eq', (a, b) => a === b);

    // Greater than helper
    Handlebars.registerHelper('gt', (a, b) => a > b);

    // Less than helper
    Handlebars.registerHelper('lt', (a, b) => a < b);
  }

  /**
   * Simple hash function for cache keys
   */
  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Clear the template cache
   */
  clearCache(): void {
    templateCache.clear();
  }
}

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  variables: string[];
}

// Default prompt templates
export const DEFAULT_TEMPLATES = {
  classifier: `You are an expert requirements analyst. Analyze the following requirement and classify it.

## Requirement
{{requirement}}

## Instructions
Classify this requirement into one of the following types:
- new_feature: A completely new capability or feature
- enhancement: An improvement to an existing feature
- epic: A large requirement that spans multiple features
- bug_fix: A defect correction or bug fix

Respond with a JSON object:
{
  "type": "new_feature" | "enhancement" | "epic" | "bug_fix",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation",
  "suggestedDecomposition": true | false
}`,

  decomposer: `You are an expert requirements decomposer. Break down the following requirement into themes, atomic requirements, and feature candidates.

## Requirement
{{requirement}}

## Requirement Type
{{requirementType}}

## Instructions
Analyze this requirement and:
1. Identify key themes
2. Extract atomic requirements (smallest testable units)
3. Group atomic requirements into feature candidates
4. Generate clarification questions for ambiguous areas

Respond with a JSON object following this structure:
{
  "themes": [
    {
      "id": "theme-1",
      "name": "Theme name",
      "description": "Theme description",
      "confidence": 0.0-1.0
    }
  ],
  "atomicRequirements": [
    {
      "id": "ar-1",
      "text": "Requirement text",
      "clarityScore": 0.0-1.0,
      "theme": "theme-1",
      "dependencies": []
    }
  ],
  "featureCandidates": [
    {
      "title": "Feature title",
      "description": "Feature description",
      "theme": "theme-1",
      "atomicRequirementIds": ["ar-1"],
      "estimatedComplexity": "low" | "medium" | "high",
      "suggestedPriority": 1-10
    }
  ],
  "clarificationQuestions": [
    {
      "question": "Question text",
      "questionType": "multiple_choice" | "yes_no" | "text",
      "options": ["Option 1", "Option 2"],
      "priority": "blocking" | "important" | "nice_to_have"
    }
  ]
}`,
};
