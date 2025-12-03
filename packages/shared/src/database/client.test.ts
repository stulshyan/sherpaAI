// Tests for Database Client utilities

import { describe, it, expect, beforeEach } from 'vitest';
import { QueryBuilder } from './client.js';

describe('QueryBuilder', () => {
  describe('param', () => {
    let builder: QueryBuilder;

    beforeEach(() => {
      builder = new QueryBuilder();
    });

    it('should generate parameter placeholders', () => {
      const placeholder1 = builder.param('value1');
      const placeholder2 = builder.param('value2');

      expect(placeholder1).toBe('$1');
      expect(placeholder2).toBe('$2');
    });

    it('should track parameter values', () => {
      builder.param('value1');
      builder.param(123);
      builder.param(true);

      expect(builder.getValues()).toEqual(['value1', 123, true]);
    });

    it('should reset correctly', () => {
      builder.param('value1');
      builder.param('value2');
      builder.reset();

      const placeholder = builder.param('newValue');
      expect(placeholder).toBe('$1');
      expect(builder.getValues()).toEqual(['newValue']);
    });
  });

  describe('insert', () => {
    it('should build INSERT statement with all columns', () => {
      const { text, values } = QueryBuilder.insert('users', {
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
      });

      expect(text).toContain('INSERT INTO users');
      expect(text).toContain('email, name, role');
      expect(text).toContain('$1, $2, $3');
      expect(text).toContain('RETURNING *');
      expect(values).toEqual(['test@example.com', 'Test User', 'admin']);
    });

    it('should support custom RETURNING clause', () => {
      const { text, values } = QueryBuilder.insert('features', { title: 'Test', status: 'draft' }, [
        'id',
        'title',
      ]);

      expect(text).toContain('RETURNING id, title');
      expect(values).toEqual(['Test', 'draft']);
    });

    it('should handle single column', () => {
      const { text, values } = QueryBuilder.insert('logs', { message: 'Test log' });

      expect(text).toContain('(message)');
      expect(text).toContain('($1)');
      expect(values).toEqual(['Test log']);
    });
  });

  describe('update', () => {
    it('should build UPDATE statement with SET clause', () => {
      const { text, values } = QueryBuilder.update(
        'features',
        { status: 'ready', priority_score: 75 },
        'id',
        'feat-123'
      );

      expect(text).toContain('UPDATE features');
      expect(text).toContain('SET status = $1, priority_score = $2');
      expect(text).toContain('WHERE id = $3');
      expect(text).toContain('RETURNING *');
      expect(values).toEqual(['ready', 75, 'feat-123']);
    });

    it('should support custom RETURNING clause', () => {
      const { text, values } = QueryBuilder.update(
        'requirements',
        { status: 'decomposed' },
        'id',
        'req-456',
        ['id', 'status', 'updated_at']
      );

      expect(text).toContain('RETURNING id, status, updated_at');
      expect(values).toEqual(['decomposed', 'req-456']);
    });

    it('should handle single column update', () => {
      const { text, values } = QueryBuilder.update(
        'users',
        { last_login: new Date('2024-01-01') },
        'email',
        'user@example.com'
      );

      expect(text).toContain('SET last_login = $1');
      expect(text).toContain('WHERE email = $2');
      expect(values[0]).toBeInstanceOf(Date);
      expect(values[1]).toBe('user@example.com');
    });
  });
});
