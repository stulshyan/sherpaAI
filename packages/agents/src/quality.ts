// Quality scoring for agent outputs

import type { QualityScore, JSONSchema } from '@entropy/shared';

/**
 * Quality scorer for agent outputs
 */
export class QualityScorer {
  /**
   * Calculate quality score for an output
   */
  score(
    output: Record<string, unknown>,
    schema?: JSONSchema
  ): QualityScore {
    const completeness = this.scoreCompleteness(output, schema);
    const consistency = this.scoreConsistency(output);
    const confidence = this.extractConfidence(output);

    const overall = (completeness + consistency + confidence) / 3;

    return {
      overall,
      completeness,
      consistency,
      confidence,
    };
  }

  /**
   * Score completeness (are all expected fields present?)
   */
  private scoreCompleteness(
    output: Record<string, unknown>,
    schema?: JSONSchema
  ): number {
    if (!schema?.properties) {
      // Without schema, score based on non-empty values
      const values = Object.values(output);
      const nonEmpty = values.filter(
        (v) => v !== null && v !== undefined && v !== ''
      );
      return values.length > 0 ? nonEmpty.length / values.length : 1;
    }

    const requiredFields = schema.required || [];
    const allFields = Object.keys(schema.properties);

    if (allFields.length === 0) return 1;

    let score = 0;
    let weight = 0;

    for (const field of allFields) {
      const isRequired = requiredFields.includes(field);
      const fieldWeight = isRequired ? 2 : 1;
      weight += fieldWeight;

      if (this.hasValue(output[field])) {
        score += fieldWeight;
      }
    }

    return weight > 0 ? score / weight : 1;
  }

  /**
   * Score consistency (no contradictions in the data)
   */
  private scoreConsistency(output: Record<string, unknown>): number {
    // Basic consistency checks
    const issues: string[] = [];

    // Check array consistency
    for (const [key, value] of Object.entries(output)) {
      if (Array.isArray(value)) {
        // Check for empty arrays that reference other arrays
        if (value.length === 0 && key.includes('Id')) {
          issues.push(`Empty ${key} array`);
        }

        // Check for duplicate IDs in arrays of objects
        const ids = value
          .filter((item): item is Record<string, unknown> =>
            typeof item === 'object' && item !== null
          )
          .map((item) => item.id)
          .filter(Boolean);

        const uniqueIds = new Set(ids);
        if (ids.length !== uniqueIds.size) {
          issues.push(`Duplicate IDs in ${key}`);
        }
      }
    }

    // Check numeric consistency
    for (const [key, value] of Object.entries(output)) {
      if (typeof value === 'number') {
        if (key.includes('Score') || key.includes('confidence')) {
          if (value < 0 || value > 1) {
            issues.push(`${key} out of range: ${value}`);
          }
        }
      }
    }

    // Calculate score based on issues
    const maxIssues = 5;
    return Math.max(0, 1 - issues.length / maxIssues);
  }

  /**
   * Extract or estimate confidence from output
   */
  private extractConfidence(output: Record<string, unknown>): number {
    // Look for explicit confidence field
    if (typeof output.confidence === 'number') {
      return output.confidence;
    }

    // Average confidence from nested objects
    const confidences: number[] = [];

    for (const value of Object.values(output)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'object' && item !== null && 'confidence' in item) {
            const conf = (item as Record<string, unknown>).confidence;
            if (typeof conf === 'number') {
              confidences.push(conf);
            }
          }
        }
      } else if (typeof value === 'object' && value !== null && 'confidence' in value) {
        const conf = (value as Record<string, unknown>).confidence;
        if (typeof conf === 'number') {
          confidences.push(conf);
        }
      }
    }

    if (confidences.length > 0) {
      return confidences.reduce((a, b) => a + b, 0) / confidences.length;
    }

    // Default to high confidence if no issues found
    return 0.8;
  }

  /**
   * Check if a value is non-empty
   */
  private hasValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  }
}

/**
 * Score thresholds for quality levels
 */
export const QUALITY_THRESHOLDS = {
  EXCELLENT: 0.9,
  GOOD: 0.7,
  ACCEPTABLE: 0.5,
  POOR: 0.3,
};

/**
 * Get quality level from score
 */
export function getQualityLevel(
  score: number
): 'excellent' | 'good' | 'acceptable' | 'poor' | 'unacceptable' {
  if (score >= QUALITY_THRESHOLDS.EXCELLENT) return 'excellent';
  if (score >= QUALITY_THRESHOLDS.GOOD) return 'good';
  if (score >= QUALITY_THRESHOLDS.ACCEPTABLE) return 'acceptable';
  if (score >= QUALITY_THRESHOLDS.POOR) return 'poor';
  return 'unacceptable';
}
