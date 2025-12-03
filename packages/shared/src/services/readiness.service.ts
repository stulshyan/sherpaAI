// Readiness Scoring Service for S-037
// Calculates feature readiness for Loop A promotion

import { READINESS_THRESHOLD_LOOP_A } from '../constants/index.js';
import type { Feature } from '../types/feature.js';
import type { AtomicRequirement, ClarificationQuestion } from '../types/requirement.js';

/**
 * Extended readiness score with component details
 */
export interface ReadinessScore {
  overall: number;
  components: {
    businessClarity: number;
    technicalClarity: number;
    testability: number;
    completeness: number;
    consistency: number;
  };
  blockingQuestions: ClarificationQuestion[];
  clarifyingQuestions: ClarificationQuestion[];
  improvementSuggestions: string[];
  readyForLoopA: boolean;
  estimatedTimeToReady: number; // Minutes
}

/**
 * Feature candidate for scoring
 */
export interface FeatureCandidateForScoring {
  id: string;
  title: string;
  description: string;
  childRequirements: string[];
  dependencies: string[];
}

/**
 * Scoring weights for each component
 */
const SCORING_WEIGHTS = {
  businessClarity: 0.3,
  technicalClarity: 0.25,
  testability: 0.25,
  completeness: 0.1,
  consistency: 0.1,
};

/**
 * Ambiguous language patterns to detect
 */
const AMBIGUOUS_PATTERNS = [
  /should be (fast|quick|responsive|user-friendly|intuitive)/i,
  /as (needed|required|appropriate)/i,
  /etc\.?$/i,
  /\btbd\b/i,
  /\bsome\b/i,
  /\bvarious\b/i,
  /\betc\b/i,
  /\band more\b/i,
  /\band so on\b/i,
];

/**
 * Service for calculating feature readiness scores
 */
export class ReadinessService {
  private readonly threshold: number;

  constructor(threshold?: number) {
    this.threshold = threshold ?? READINESS_THRESHOLD_LOOP_A;
  }

  /**
   * Calculate readiness score for a feature
   */
  calculateScore(
    feature: FeatureCandidateForScoring,
    atomicRequirements: AtomicRequirement[],
    questions: ClarificationQuestion[]
  ): ReadinessScore {
    // Filter requirements and questions for this feature
    const featureARs = atomicRequirements.filter((ar) => feature.childRequirements.includes(ar.id));
    const featureQuestions = questions.filter((q) => q.featureId === feature.id);

    // Calculate component scores
    const components = {
      businessClarity: this.scoreBusinessClarity(feature, featureARs),
      technicalClarity: this.scoreTechnicalClarity(feature, featureARs),
      testability: this.scoreTestability(featureARs),
      completeness: this.scoreCompleteness(feature, featureARs, featureQuestions),
      consistency: this.scoreConsistency(feature, featureARs),
    };

    // Calculate weighted overall score
    const overall = Object.entries(components).reduce(
      (sum, [key, value]) => sum + value * SCORING_WEIGHTS[key as keyof typeof SCORING_WEIGHTS],
      0
    );

    // Identify blocking and clarifying questions
    const blockingQuestions = featureQuestions.filter(
      (q) => q.priority === 'blocking' && !q.answer
    );
    const clarifyingQuestions = featureQuestions.filter(
      (q) => q.priority !== 'blocking' && !q.answer
    );

    // Generate improvement suggestions
    const improvementSuggestions = this.generateSuggestions(components, featureARs);

    // Round to 2 decimal places
    const roundedOverall = Math.round(overall * 100) / 100;

    return {
      overall: roundedOverall,
      components: {
        businessClarity: Math.round(components.businessClarity * 100) / 100,
        technicalClarity: Math.round(components.technicalClarity * 100) / 100,
        testability: Math.round(components.testability * 100) / 100,
        completeness: Math.round(components.completeness * 100) / 100,
        consistency: Math.round(components.consistency * 100) / 100,
      },
      blockingQuestions,
      clarifyingQuestions,
      improvementSuggestions,
      readyForLoopA: roundedOverall >= this.threshold && blockingQuestions.length === 0,
      estimatedTimeToReady: blockingQuestions.length * 10, // 10 min per blocking question
    };
  }

  /**
   * Calculate readiness for a stored feature
   */
  calculateForFeature(
    feature: Feature,
    atomicRequirements: AtomicRequirement[],
    questions: ClarificationQuestion[]
  ): ReadinessScore {
    return this.calculateScore(
      {
        id: feature.id,
        title: feature.title,
        description: feature.description,
        childRequirements: atomicRequirements.map((ar) => ar.id),
        dependencies: [], // Would need to be passed in
      },
      atomicRequirements,
      questions
    );
  }

  /**
   * Score business clarity
   */
  private scoreBusinessClarity(
    feature: FeatureCandidateForScoring,
    ars: AtomicRequirement[]
  ): number {
    let score = 0;
    const text = feature.description + ' ' + ars.map((ar) => ar.text).join(' ');

    // Has user story pattern
    const hasUserStory = /as a .+, i want .+/i.test(feature.description);
    if (hasUserStory) score += 0.3;

    // Has business value statement
    const hasBusinessValue = /(value|benefit|improve|increase|reduce|save|enable|allow)/i.test(
      feature.description
    );
    if (hasBusinessValue) score += 0.3;

    // Has stakeholder mentioned
    const hasStakeholder = /(user|admin|customer|client|manager|team|developer|operator)/i.test(
      feature.description
    );
    if (hasStakeholder) score += 0.2;

    // No ambiguous language (deduct for each pattern found)
    const ambiguityCount = AMBIGUOUS_PATTERNS.filter((p) => p.test(text)).length;
    score += Math.max(0, 0.2 - ambiguityCount * 0.05);

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Score technical clarity
   */
  private scoreTechnicalClarity(
    feature: FeatureCandidateForScoring,
    ars: AtomicRequirement[]
  ): number {
    let score = 0;
    const text = ars.map((ar) => ar.text).join(' ');

    // Has system context
    if (/(api|database|service|module|component|endpoint|interface)/i.test(text)) {
      score += 0.3;
    }

    // Has integration points
    if (/(integrate|connect|call|webhook|event|subscribe|publish)/i.test(text)) {
      score += 0.3;
    }

    // Has data requirements
    if (/(store|save|retrieve|query|data|record|field|column|table)/i.test(text)) {
      score += 0.2;
    }

    // All dependencies are defined (not UNDEFINED)
    const undefinedDeps = feature.dependencies.filter((d) => d.startsWith('UNDEFINED'));
    if (undefinedDeps.length === 0) {
      score += 0.2;
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Score testability
   */
  private scoreTestability(ars: AtomicRequirement[]): number {
    if (ars.length === 0) return 0.5; // Default for empty

    let score = 0;

    // Calculate average clarity score from atomic requirements
    const avgClarity = ars.reduce((sum, ar) => sum + (ar.clarityScore || 0), 0) / ars.length;
    score += avgClarity * 0.4;

    // Check for measurable criteria in text
    const measurablePatterns =
      /(should|must|will|shall) .*(return|display|show|be|have|contain|respond|complete)/i;
    const withMeasurable = ars.filter((ar) => measurablePatterns.test(ar.text));
    score += (withMeasurable.length / ars.length) * 0.3;

    // Check for specific values/metrics
    const hasMetrics = ars.some((ar) =>
      /(\d+\s*(ms|seconds?|minutes?|%|percent|times?|requests?))/i.test(ar.text)
    );
    if (hasMetrics) score += 0.3;

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Score completeness
   */
  private scoreCompleteness(
    feature: FeatureCandidateForScoring,
    ars: AtomicRequirement[],
    questions: ClarificationQuestion[]
  ): number {
    let score = 1;

    // Deduct for unanswered questions
    const unanswered = questions.filter((q) => !q.answer);
    score -= unanswered.length * 0.1;

    // Deduct for TBD placeholders
    const text = feature.description + ' ' + ars.map((ar) => ar.text).join(' ');
    const tbdCount = (text.match(/\btbd\b/gi) || []).length;
    score -= tbdCount * 0.15;

    // Deduct for very short requirements
    const shortReqs = ars.filter((ar) => ar.text.split(' ').length < 5);
    score -= (shortReqs.length / Math.max(1, ars.length)) * 0.2;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Score consistency
   */
  private scoreConsistency(feature: FeatureCandidateForScoring, ars: AtomicRequirement[]): number {
    let score = 1;

    // Check circular dependencies
    if (feature.dependencies.includes(feature.id)) {
      score -= 0.5;
    }

    // Check for contradicting keywords (basic check)
    const text = ars
      .map((ar) => ar.text)
      .join(' ')
      .toLowerCase();
    const contradictions = [
      { pattern: /\brequired\b.*\boptional\b/i, weight: 0.2 },
      { pattern: /\balways\b.*\bnever\b/i, weight: 0.2 },
      { pattern: /\bmust\b.*\bshould not\b/i, weight: 0.2 },
    ];

    for (const { pattern, weight } of contradictions) {
      if (pattern.test(text)) {
        score -= weight;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Generate improvement suggestions based on scores
   */
  private generateSuggestions(
    components: {
      businessClarity: number;
      technicalClarity: number;
      testability: number;
      completeness: number;
      consistency: number;
    },
    _ars: AtomicRequirement[]
  ): string[] {
    const suggestions: string[] = [];

    if (components.businessClarity < 0.7) {
      suggestions.push(
        'Add a clear user story format (As a [role], I want [feature] so that [benefit])'
      );
      suggestions.push('Define the business value and expected outcomes');
    }

    if (components.technicalClarity < 0.7) {
      suggestions.push('Specify integration points and data requirements');
      suggestions.push('Identify all system dependencies explicitly');
    }

    if (components.testability < 0.7) {
      suggestions.push('Add measurable acceptance criteria');
      suggestions.push('Define specific success metrics (response time, error rate, etc.)');
    }

    if (components.completeness < 0.7) {
      suggestions.push('Answer all blocking questions');
      suggestions.push('Replace TBD placeholders with actual values');
    }

    if (components.consistency < 0.9) {
      suggestions.push('Review requirements for contradicting statements');
      suggestions.push('Verify all dependencies are correctly defined');
    }

    return suggestions;
  }

  /**
   * Get the readiness threshold
   */
  getThreshold(): number {
    return this.threshold;
  }
}

/**
 * Create a readiness service instance
 */
export function createReadinessService(threshold?: number): ReadinessService {
  return new ReadinessService(threshold);
}
