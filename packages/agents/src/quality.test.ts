// QualityScorer tests

import type { JSONSchema } from '@entropy/shared';
import { describe, it, expect, beforeEach } from 'vitest';
import { QualityScorer, QUALITY_THRESHOLDS, getQualityLevel } from './quality.js';

describe('QualityScorer', () => {
  let scorer: QualityScorer;

  beforeEach(() => {
    scorer = new QualityScorer();
  });

  describe('score()', () => {
    it('should return quality score with all dimensions', () => {
      const output = {
        type: 'new_feature',
        confidence: 0.9,
        reasoning: 'Test reasoning',
      };

      const score = scorer.score(output);

      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(1);
      expect(score.completeness).toBeDefined();
      expect(score.consistency).toBeDefined();
      expect(score.confidence).toBeDefined();
    });

    it('should calculate overall as average of dimensions', () => {
      const output = {
        type: 'test',
        value: 42,
        confidence: 0.8,
      };

      const score = scorer.score(output);

      const expectedOverall = (score.completeness + score.consistency + score.confidence) / 3;
      expect(score.overall).toBeCloseTo(expectedOverall, 5);
    });
  });

  describe('completeness scoring', () => {
    it('should score high for complete output without schema', () => {
      const output = {
        field1: 'value1',
        field2: 'value2',
        field3: 42,
      };

      const score = scorer.score(output);

      expect(score.completeness).toBe(1);
    });

    it('should score lower for output with empty values', () => {
      const output = {
        field1: 'value',
        field2: null,
        field3: undefined,
        field4: '',
      };

      const score = scorer.score(output);

      expect(score.completeness).toBeLessThan(1);
    });

    it('should weight required fields higher when schema provided', () => {
      const schema: JSONSchema = {
        type: 'object',
        required: ['important'],
        properties: {
          important: { type: 'string' },
          optional: { type: 'string' },
        },
      };

      const withRequired = { important: 'yes', optional: '' };
      const withoutRequired = { important: '', optional: 'yes' };

      const scoreWithRequired = scorer.score(withRequired, schema);
      const scoreWithoutRequired = scorer.score(withoutRequired, schema);

      // Having required field should score better than having optional field
      expect(scoreWithRequired.completeness).toBeGreaterThan(scoreWithoutRequired.completeness);
    });

    it('should return 1 for empty schema properties', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {},
      };

      const score = scorer.score({}, schema);

      expect(score.completeness).toBe(1);
    });

    it('should return 1 for empty output without schema', () => {
      const score = scorer.score({});

      expect(score.completeness).toBe(1);
    });
  });

  describe('consistency scoring', () => {
    it('should score high for consistent data', () => {
      const output = {
        items: [
          { id: 'item-1', name: 'First' },
          { id: 'item-2', name: 'Second' },
        ],
        confidence: 0.8,
      };

      const score = scorer.score(output);

      expect(score.consistency).toBe(1);
    });

    it('should detect duplicate IDs in arrays', () => {
      const output = {
        items: [
          { id: 'same-id', name: 'First' },
          { id: 'same-id', name: 'Second' },
        ],
      };

      const score = scorer.score(output);

      expect(score.consistency).toBeLessThan(1);
    });

    it('should detect confidence scores out of range', () => {
      const output = {
        confidence: 1.5, // Out of 0-1 range
      };

      const score = scorer.score(output);

      expect(score.consistency).toBeLessThan(1);
    });

    it('should detect negative confidence scores', () => {
      const output = {
        confidence: -0.5,
      };

      const score = scorer.score(output);

      expect(score.consistency).toBeLessThan(1);
    });

    it('should detect score fields out of range', () => {
      const output = {
        qualityScore: 2.0, // Out of range
      };

      const score = scorer.score(output);

      expect(score.consistency).toBeLessThan(1);
    });

    it('should handle multiple consistency issues', () => {
      const output = {
        items: [
          { id: 'dup', value: 1 },
          { id: 'dup', value: 2 },
        ],
        confidence: 5.0,
        qualityScore: -1,
      };

      const score = scorer.score(output);

      // Multiple issues should lower score more
      expect(score.consistency).toBeLessThan(0.8);
    });
  });

  describe('confidence extraction', () => {
    it('should extract explicit confidence field', () => {
      const output = {
        type: 'test',
        confidence: 0.85,
      };

      const score = scorer.score(output);

      expect(score.confidence).toBe(0.85);
    });

    it('should average confidence from nested array objects', () => {
      const output = {
        themes: [
          { id: '1', confidence: 0.9 },
          { id: '2', confidence: 0.7 },
        ],
      };

      const score = scorer.score(output);

      expect(score.confidence).toBeCloseTo(0.8, 2);
    });

    it('should average confidence from nested objects', () => {
      const output = {
        result: {
          confidence: 0.75,
        },
      };

      const score = scorer.score(output);

      expect(score.confidence).toBe(0.75);
    });

    it('should default to 0.8 when no confidence found', () => {
      const output = {
        type: 'test',
        data: 'value',
      };

      const score = scorer.score(output);

      expect(score.confidence).toBe(0.8);
    });

    it('should combine confidence from multiple sources', () => {
      const output = {
        themes: [{ confidence: 0.9 }],
        requirements: [{ confidence: 0.7 }, { confidence: 0.8 }],
      };

      const score = scorer.score(output);

      // Average of 0.9, 0.7, 0.8 = 0.8
      expect(score.confidence).toBeCloseTo(0.8, 2);
    });
  });
});

describe('QUALITY_THRESHOLDS', () => {
  it('should have correct threshold values', () => {
    expect(QUALITY_THRESHOLDS.EXCELLENT).toBe(0.9);
    expect(QUALITY_THRESHOLDS.GOOD).toBe(0.7);
    expect(QUALITY_THRESHOLDS.ACCEPTABLE).toBe(0.5);
    expect(QUALITY_THRESHOLDS.POOR).toBe(0.3);
  });

  it('should have descending thresholds', () => {
    expect(QUALITY_THRESHOLDS.EXCELLENT).toBeGreaterThan(QUALITY_THRESHOLDS.GOOD);
    expect(QUALITY_THRESHOLDS.GOOD).toBeGreaterThan(QUALITY_THRESHOLDS.ACCEPTABLE);
    expect(QUALITY_THRESHOLDS.ACCEPTABLE).toBeGreaterThan(QUALITY_THRESHOLDS.POOR);
  });
});

describe('getQualityLevel()', () => {
  it('should return excellent for scores >= 0.9', () => {
    expect(getQualityLevel(0.9)).toBe('excellent');
    expect(getQualityLevel(0.95)).toBe('excellent');
    expect(getQualityLevel(1.0)).toBe('excellent');
  });

  it('should return good for scores >= 0.7 and < 0.9', () => {
    expect(getQualityLevel(0.7)).toBe('good');
    expect(getQualityLevel(0.8)).toBe('good');
    expect(getQualityLevel(0.89)).toBe('good');
  });

  it('should return acceptable for scores >= 0.5 and < 0.7', () => {
    expect(getQualityLevel(0.5)).toBe('acceptable');
    expect(getQualityLevel(0.6)).toBe('acceptable');
    expect(getQualityLevel(0.69)).toBe('acceptable');
  });

  it('should return poor for scores >= 0.3 and < 0.5', () => {
    expect(getQualityLevel(0.3)).toBe('poor');
    expect(getQualityLevel(0.4)).toBe('poor');
    expect(getQualityLevel(0.49)).toBe('poor');
  });

  it('should return unacceptable for scores < 0.3', () => {
    expect(getQualityLevel(0.0)).toBe('unacceptable');
    expect(getQualityLevel(0.1)).toBe('unacceptable');
    expect(getQualityLevel(0.29)).toBe('unacceptable');
  });

  it('should handle edge cases at boundaries', () => {
    expect(getQualityLevel(0.9)).toBe('excellent');
    expect(getQualityLevel(0.7)).toBe('good');
    expect(getQualityLevel(0.5)).toBe('acceptable');
    expect(getQualityLevel(0.3)).toBe('poor');
  });
});
