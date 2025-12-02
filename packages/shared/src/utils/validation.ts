// Validation utilities

import type { JSONSchema } from '../types/adapter.js';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  value?: unknown;
}

/**
 * Simple JSON schema validation
 * For production, use a library like ajv
 */
export function validateSchema(
  data: unknown,
  schema: JSONSchema
): ValidationResult {
  const errors: ValidationError[] = [];

  function validate(value: unknown, schema: JSONSchema, path: string): void {
    if (schema.type === 'object' && typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;

      // Check required fields
      if (schema.required) {
        for (const field of schema.required) {
          if (!(field in obj)) {
            errors.push({
              path: `${path}.${field}`,
              message: `Required field missing: ${field}`,
            });
          }
        }
      }

      // Validate properties
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (key in obj) {
            validate(obj[key], propSchema as JSONSchema, `${path}.${key}`);
          }
        }
      }
    } else if (schema.type === 'array' && Array.isArray(value)) {
      if (schema.items) {
        value.forEach((item, index) => {
          validate(item, schema.items as JSONSchema, `${path}[${index}]`);
        });
      }
    } else if (schema.type === 'string' && typeof value !== 'string') {
      errors.push({
        path,
        message: `Expected string, got ${typeof value}`,
        value,
      });
    } else if (schema.type === 'number' && typeof value !== 'number') {
      errors.push({
        path,
        message: `Expected number, got ${typeof value}`,
        value,
      });
    } else if (schema.type === 'boolean' && typeof value !== 'boolean') {
      errors.push({
        path,
        message: `Expected boolean, got ${typeof value}`,
        value,
      });
    }

    // Check enum
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({
        path,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        value,
      });
    }
  }

  validate(data, schema, '$');

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate UUID format
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Validate email format
 */
export function isValidEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Sanitize string for safe display
 */
export function sanitizeString(value: string): string {
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
