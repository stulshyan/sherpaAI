// Tests for Base Repository utilities

import { describe, it, expect } from 'vitest';
import {
  snakeToCamel,
  camelToSnake,
  rowToEntityBase,
  entityToRowBase,
} from './base-repository.js';

describe('snakeToCamel', () => {
  it('should convert snake_case to camelCase', () => {
    expect(snakeToCamel('created_at')).toBe('createdAt');
    expect(snakeToCamel('project_id')).toBe('projectId');
    expect(snakeToCamel('source_file_s3_key')).toBe('sourceFileS3Key');
  });

  it('should handle single words', () => {
    expect(snakeToCamel('id')).toBe('id');
    expect(snakeToCamel('name')).toBe('name');
  });

  it('should handle multiple underscores', () => {
    expect(snakeToCamel('is_active_user')).toBe('isActiveUser');
    expect(snakeToCamel('feature_priority_score')).toBe('featurePriorityScore');
  });
});

describe('camelToSnake', () => {
  it('should convert camelCase to snake_case', () => {
    expect(camelToSnake('createdAt')).toBe('created_at');
    expect(camelToSnake('projectId')).toBe('project_id');
    expect(camelToSnake('sourceFileS3Key')).toBe('source_file_s3_key');
  });

  it('should handle single words', () => {
    expect(camelToSnake('id')).toBe('id');
    expect(camelToSnake('name')).toBe('name');
  });

  it('should handle consecutive capitals', () => {
    expect(camelToSnake('s3Key')).toBe('s3_key');
    expect(camelToSnake('isActive')).toBe('is_active');
  });
});

describe('rowToEntityBase', () => {
  it('should convert row object to entity with camelCase keys', () => {
    const row = {
      id: 'test-id',
      project_id: 'proj-123',
      created_at: new Date('2024-01-01'),
      is_active: true,
      priority_score: '75.5',
    };

    const entity = rowToEntityBase(row);

    expect(entity).toEqual({
      id: 'test-id',
      projectId: 'proj-123',
      createdAt: new Date('2024-01-01'),
      isActive: true,
      priorityScore: '75.5',
    });
  });

  it('should handle null values', () => {
    const row = {
      id: 'test-id',
      parent_feature_id: null,
      error_message: null,
    };

    const entity = rowToEntityBase(row);

    expect(entity).toEqual({
      id: 'test-id',
      parentFeatureId: null,
      errorMessage: null,
    });
  });

  it('should handle nested objects', () => {
    const row = {
      id: 'test-id',
      metadata: { key: 'value' },
      raw_metadata: { nested: { deep: 'value' } },
    };

    const entity = rowToEntityBase(row);

    expect(entity.metadata).toEqual({ key: 'value' });
    expect(entity.rawMetadata).toEqual({ nested: { deep: 'value' } });
  });
});

describe('entityToRowBase', () => {
  it('should convert entity object to row with snake_case keys', () => {
    const entity = {
      id: 'test-id',
      projectId: 'proj-123',
      createdAt: new Date('2024-01-01'),
      isActive: true,
      priorityScore: 75.5,
    };

    const row = entityToRowBase(entity);

    expect(row).toEqual({
      id: 'test-id',
      project_id: 'proj-123',
      created_at: new Date('2024-01-01'),
      is_active: true,
      priority_score: 75.5,
    });
  });

  it('should exclude undefined values', () => {
    const entity = {
      id: 'test-id',
      projectId: 'proj-123',
      description: undefined,
      errorMessage: undefined,
    };

    const row = entityToRowBase(entity);

    expect(row).toEqual({
      id: 'test-id',
      project_id: 'proj-123',
    });
    expect(row).not.toHaveProperty('description');
    expect(row).not.toHaveProperty('error_message');
  });

  it('should include null values', () => {
    const entity = {
      id: 'test-id',
      parentFeatureId: null,
    };

    const row = entityToRowBase(entity);

    expect(row).toEqual({
      id: 'test-id',
      parent_feature_id: null,
    });
  });
});
