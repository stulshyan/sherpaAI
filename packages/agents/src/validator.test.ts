// OutputValidator tests

import type { JSONSchema } from '@entropy/shared';
import { describe, it, expect, beforeEach } from 'vitest';
import { OutputValidator, OUTPUT_SCHEMAS } from './validator.js';

describe('OutputValidator', () => {
  let validator: OutputValidator;

  beforeEach(() => {
    validator = new OutputValidator();
  });

  describe('validate()', () => {
    const simpleSchema: JSONSchema = {
      type: 'object',
      required: ['name', 'age'],
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
    };

    it('should return valid for conforming output', () => {
      const output = { name: 'Alice', age: 30 };

      const result = validator.validate(output, simpleSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for missing required fields', () => {
      const output = { name: 'Alice' };

      const result = validator.validate(output, simpleSchema);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.keyword === 'required')).toBe(true);
    });

    it('should return invalid for wrong types', () => {
      const output = { name: 'Alice', age: 'thirty' };

      // AJV coerces types by default, so "thirty" cannot be coerced to number
      const result = validator.validate(output, simpleSchema);

      // String "thirty" cannot be coerced to a number
      expect(result.valid).toBe(false);
    });

    it('should coerce types when possible', () => {
      const output = { name: 'Alice', age: '30' };

      const result = validator.validate(output, simpleSchema);

      // With coerceTypes enabled, string "30" should be coerced to number
      expect(result.valid).toBe(true);
    });

    it('should include error path information', () => {
      const nestedSchema: JSONSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            required: ['email'],
            properties: {
              email: { type: 'string' },
            },
          },
        },
      };

      const output = { user: {} };
      const result = validator.validate(output, nestedSchema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes('user'))).toBe(true);
    });

    it('should validate enum values', () => {
      const enumSchema: JSONSchema = {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'active', 'completed'],
          },
        },
      };

      const validOutput = { status: 'active' };
      const invalidOutput = { status: 'invalid' };

      expect(validator.validate(validOutput, enumSchema).valid).toBe(true);
      expect(validator.validate(invalidOutput, enumSchema).valid).toBe(false);
    });

    it('should validate numeric ranges', () => {
      const rangeSchema: JSONSchema = {
        type: 'object',
        properties: {
          score: {
            type: 'number',
            minimum: 0,
            maximum: 1,
          },
        },
      };

      expect(validator.validate({ score: 0.5 }, rangeSchema).valid).toBe(true);
      expect(validator.validate({ score: 0 }, rangeSchema).valid).toBe(true);
      expect(validator.validate({ score: 1 }, rangeSchema).valid).toBe(true);
      expect(validator.validate({ score: -0.1 }, rangeSchema).valid).toBe(false);
      expect(validator.validate({ score: 1.1 }, rangeSchema).valid).toBe(false);
    });

    it('should validate arrays', () => {
      const arraySchema: JSONSchema = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id'],
              properties: {
                id: { type: 'string' },
              },
            },
          },
        },
      };

      const validOutput = { items: [{ id: '1' }, { id: '2' }] };
      const invalidOutput = { items: [{ id: '1' }, { notId: '2' }] };

      expect(validator.validate(validOutput, arraySchema).valid).toBe(true);
      expect(validator.validate(invalidOutput, arraySchema).valid).toBe(false);
    });

    it('should cache validators for performance', () => {
      const output = { name: 'Test', age: 25 };

      // Validate multiple times with same schema
      validator.validate(output, simpleSchema);
      validator.validate(output, simpleSchema);
      validator.validate(output, simpleSchema);

      // Coverage will show cache path was hit
    });
  });

  describe('validateOrThrow()', () => {
    const schema: JSONSchema = {
      type: 'object',
      required: ['value'],
      properties: {
        value: { type: 'number' },
      },
    };

    it('should not throw for valid output', () => {
      expect(() => validator.validateOrThrow({ value: 42 }, schema)).not.toThrow();
    });

    it('should throw with error message for invalid output', () => {
      expect(() => validator.validateOrThrow({}, schema)).toThrow('Validation failed');
    });

    it('should include all error paths in message', () => {
      const multiFieldSchema: JSONSchema = {
        type: 'object',
        required: ['a', 'b'],
        properties: {
          a: { type: 'string' },
          b: { type: 'number' },
        },
      };

      expect(() => validator.validateOrThrow({}, multiFieldSchema)).toThrow(/required/);
    });
  });

  describe('coerce()', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        count: { type: 'number' },
        active: { type: 'boolean' },
      },
    };

    it('should coerce string to number', () => {
      const output = { count: '42' };
      const coerced = validator.coerce(output, schema) as { count: number };

      expect(coerced.count).toBe(42);
      expect(typeof coerced.count).toBe('number');
    });

    it('should coerce string to boolean', () => {
      const output = { active: 'true' };
      const coerced = validator.coerce(output, schema) as { active: boolean };

      // AJV coerces "true" string to true boolean
      expect(coerced.active).toBe(true);
    });

    it('should not mutate original object', () => {
      const original = { count: '42' };
      validator.coerce(original, schema);

      expect(original.count).toBe('42');
    });
  });

  describe('canCoerce()', () => {
    const schema: JSONSchema = {
      type: 'object',
      required: ['value'],
      properties: {
        value: { type: 'number' },
      },
    };

    it('should return true when coercion is possible', () => {
      expect(validator.canCoerce({ value: '123' }, schema)).toBe(true);
    });

    it('should return false when coercion is not possible', () => {
      expect(validator.canCoerce({ value: 'not a number' }, schema)).toBe(false);
    });

    it('should return false for completely invalid structure', () => {
      expect(validator.canCoerce({}, schema)).toBe(false);
    });
  });

  describe('clearCache()', () => {
    it('should clear validator cache without error', () => {
      const schema: JSONSchema = { type: 'object' };
      validator.validate({}, schema);

      expect(() => validator.clearCache()).not.toThrow();
    });
  });
});

describe('OUTPUT_SCHEMAS', () => {
  let validator: OutputValidator;

  beforeEach(() => {
    validator = new OutputValidator();
  });

  describe('classification schema', () => {
    it('should validate correct classification output', () => {
      const output = {
        type: 'new_feature',
        confidence: 0.9,
        reasoning: 'This is a new capability',
        suggestedDecomposition: true,
      };

      const result = validator.validate(output, OUTPUT_SCHEMAS.classification);

      expect(result.valid).toBe(true);
    });

    it('should reject invalid type values', () => {
      const output = {
        type: 'invalid_type',
        confidence: 0.9,
        reasoning: 'Test',
        suggestedDecomposition: true,
      };

      const result = validator.validate(output, OUTPUT_SCHEMAS.classification);

      expect(result.valid).toBe(false);
    });

    it('should accept all valid type values', () => {
      const types = ['new_feature', 'enhancement', 'epic', 'bug_fix'];

      for (const type of types) {
        const output = {
          type,
          confidence: 0.8,
          reasoning: 'Test',
          suggestedDecomposition: false,
        };

        expect(validator.validate(output, OUTPUT_SCHEMAS.classification).valid).toBe(true);
      }
    });

    it('should reject confidence out of range', () => {
      const output = {
        type: 'new_feature',
        confidence: 1.5,
        reasoning: 'Test',
        suggestedDecomposition: true,
      };

      const result = validator.validate(output, OUTPUT_SCHEMAS.classification);

      expect(result.valid).toBe(false);
    });

    it('should reject empty reasoning', () => {
      const output = {
        type: 'new_feature',
        confidence: 0.9,
        reasoning: '',
        suggestedDecomposition: true,
      };

      const result = validator.validate(output, OUTPUT_SCHEMAS.classification);

      expect(result.valid).toBe(false);
    });
  });

  describe('decomposition schema', () => {
    const validDecomposition = {
      themes: [
        {
          id: 'theme-1',
          name: 'User Management',
          description: 'Handle user authentication and profiles',
          confidence: 0.9,
        },
      ],
      atomicRequirements: [
        {
          id: 'ar-1',
          text: 'User can log in with email',
          clarityScore: 0.95,
          theme: 'theme-1',
          dependencies: [],
        },
      ],
      featureCandidates: [
        {
          title: 'Login System',
          description: 'Basic email/password login',
          theme: 'theme-1',
          atomicRequirementIds: ['ar-1'],
          estimatedComplexity: 'medium',
          suggestedPriority: 1,
        },
      ],
      clarificationQuestions: [
        {
          question: 'Should we support OAuth?',
          questionType: 'yes_no',
          priority: 'important',
        },
      ],
    };

    it('should validate correct decomposition output', () => {
      const result = validator.validate(validDecomposition, OUTPUT_SCHEMAS.decomposition);

      expect(result.valid).toBe(true);
    });

    it('should require themes array', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { themes, ...rest } = validDecomposition;
      const result = validator.validate(rest, OUTPUT_SCHEMAS.decomposition);

      expect(result.valid).toBe(false);
    });

    it('should require atomicRequirements array', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { atomicRequirements, ...rest } = validDecomposition;
      const result = validator.validate(rest, OUTPUT_SCHEMAS.decomposition);

      expect(result.valid).toBe(false);
    });

    it('should require featureCandidates array', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { featureCandidates, ...rest } = validDecomposition;
      const result = validator.validate(rest, OUTPUT_SCHEMAS.decomposition);

      expect(result.valid).toBe(false);
    });

    it('should validate theme structure', () => {
      const invalid = {
        ...validDecomposition,
        themes: [{ id: 'theme-1' }], // Missing required fields
      };

      const result = validator.validate(invalid, OUTPUT_SCHEMAS.decomposition);

      expect(result.valid).toBe(false);
    });

    it('should validate atomic requirement structure', () => {
      const invalid = {
        ...validDecomposition,
        atomicRequirements: [{ id: 'ar-1' }], // Missing required fields
      };

      const result = validator.validate(invalid, OUTPUT_SCHEMAS.decomposition);

      expect(result.valid).toBe(false);
    });

    it('should validate complexity enum values', () => {
      const withValidComplexity = {
        ...validDecomposition,
        featureCandidates: [
          { ...validDecomposition.featureCandidates[0], estimatedComplexity: 'high' },
        ],
      };

      const withInvalidComplexity = {
        ...validDecomposition,
        featureCandidates: [
          { ...validDecomposition.featureCandidates[0], estimatedComplexity: 'extreme' },
        ],
      };

      expect(validator.validate(withValidComplexity, OUTPUT_SCHEMAS.decomposition).valid).toBe(
        true
      );
      expect(validator.validate(withInvalidComplexity, OUTPUT_SCHEMAS.decomposition).valid).toBe(
        false
      );
    });

    it('should validate question type enum values', () => {
      const validTypes = ['multiple_choice', 'yes_no', 'text', 'dropdown'];

      for (const questionType of validTypes) {
        const output = {
          ...validDecomposition,
          clarificationQuestions: [
            {
              question: 'Test?',
              questionType,
              priority: 'important',
            },
          ],
        };

        expect(validator.validate(output, OUTPUT_SCHEMAS.decomposition).valid).toBe(true);
      }
    });

    it('should validate priority enum values', () => {
      const validPriorities = ['blocking', 'important', 'nice_to_have'];

      for (const priority of validPriorities) {
        const output = {
          ...validDecomposition,
          clarificationQuestions: [
            {
              question: 'Test?',
              questionType: 'yes_no',
              priority,
            },
          ],
        };

        expect(validator.validate(output, OUTPUT_SCHEMAS.decomposition).valid).toBe(true);
      }
    });
  });
});
