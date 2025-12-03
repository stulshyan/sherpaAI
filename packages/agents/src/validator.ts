// Output validation using JSON Schema

import type { JSONSchema } from '@entropy/shared';
import Ajv, { type Schema, type ValidateFunction } from 'ajv';

const ajv = new Ajv({
  allErrors: true,
  coerceTypes: true,
  useDefaults: true,
});

// Cache compiled validators
const validatorCache = new Map<string, ValidateFunction>();

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  coerced?: unknown;
}

export interface ValidationError {
  path: string;
  message: string;
  keyword: string;
  params: Record<string, unknown>;
}

/**
 * Output validator using JSON Schema (ajv)
 */
export class OutputValidator {
  /**
   * Validate output against a JSON Schema
   */
  validate(output: unknown, schema: JSONSchema): ValidationResult {
    const validator = this.getValidator(schema);
    const valid = validator(output);

    if (valid) {
      return { valid: true, errors: [], coerced: output };
    }

    const errors: ValidationError[] = (validator.errors || []).map((err) => ({
      path: err.instancePath || '$',
      message: err.message || 'Validation error',
      keyword: err.keyword,
      params: err.params as Record<string, unknown>,
    }));

    return { valid: false, errors };
  }

  /**
   * Validate and throw if invalid
   */
  validateOrThrow(output: unknown, schema: JSONSchema): void {
    const result = this.validate(output, schema);
    if (!result.valid) {
      const errorMessages = result.errors.map((e) => `${e.path}: ${e.message}`).join('; ');
      throw new Error(`Validation failed: ${errorMessages}`);
    }
  }

  /**
   * Attempt to coerce output to match schema
   */
  coerce(output: unknown, schema: JSONSchema): unknown {
    const clone = JSON.parse(JSON.stringify(output));
    const validator = this.getValidator(schema);
    validator(clone);
    return clone;
  }

  /**
   * Check if output could potentially match schema with coercion
   */
  canCoerce(output: unknown, schema: JSONSchema): boolean {
    try {
      const coerced = this.coerce(output, schema);
      const result = this.validate(coerced, schema);
      return result.valid;
    } catch {
      return false;
    }
  }

  private getValidator(schema: JSONSchema): ValidateFunction {
    const cacheKey = JSON.stringify(schema);
    let validator = validatorCache.get(cacheKey);

    if (!validator) {
      validator = ajv.compile(schema as Schema);
      validatorCache.set(cacheKey, validator);
    }

    return validator;
  }

  /**
   * Clear the validator cache
   */
  clearCache(): void {
    validatorCache.clear();
  }
}

// Common output schemas
export const OUTPUT_SCHEMAS = {
  classification: {
    type: 'object',
    required: ['type', 'confidence', 'reasoning', 'suggestedDecomposition'],
    properties: {
      type: {
        type: 'string',
        enum: ['new_feature', 'enhancement', 'epic', 'bug_fix'],
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
      },
      reasoning: {
        type: 'string',
        minLength: 1,
      },
      suggestedDecomposition: {
        type: 'boolean',
      },
      indicators: {
        type: 'object',
        properties: {
          hasMultipleThemes: { type: 'boolean' },
          estimatedComplexity: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
          },
          scopeIndicators: {
            type: 'array',
            items: { type: 'string' },
          },
          ambiguityFlags: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
  } as JSONSchema,

  decomposition: {
    type: 'object',
    required: ['themes', 'atomicRequirements', 'featureCandidates'],
    properties: {
      themes: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'name', 'description', 'confidence'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
        },
      },
      atomicRequirements: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'text', 'clarityScore'],
          properties: {
            id: { type: 'string' },
            text: { type: 'string' },
            clarityScore: { type: 'number', minimum: 0, maximum: 1 },
            theme: { type: 'string' },
            dependencies: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      featureCandidates: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'description', 'theme', 'atomicRequirementIds'],
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            theme: { type: 'string' },
            atomicRequirementIds: { type: 'array', items: { type: 'string' } },
            estimatedComplexity: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
            },
            suggestedPriority: { type: 'number', minimum: 1, maximum: 10 },
          },
        },
      },
      clarificationQuestions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['question', 'questionType', 'priority'],
          properties: {
            question: { type: 'string' },
            questionType: {
              type: 'string',
              enum: ['multiple_choice', 'yes_no', 'text', 'dropdown'],
            },
            options: { type: 'array', items: { type: 'string' } },
            priority: {
              type: 'string',
              enum: ['blocking', 'important', 'nice_to_have'],
            },
          },
        },
      },
    },
  } as JSONSchema,
};
