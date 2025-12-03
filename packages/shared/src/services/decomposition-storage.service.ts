// Decomposition Storage Service for S-040
// Handles versioned storage of decomposition results

import { randomUUID } from 'crypto';
import { createStorageService, type StorageService } from '../storage/storage.service.js';
import { getDatabase, type DatabaseClient } from '../database/client.js';
import type {
  DecompositionResult,
  Theme,
  AtomicRequirement,
  FeatureCandidate,
  ClarificationQuestion,
} from '../types/requirement.js';

/**
 * Decomposition version metadata
 */
export interface DecompositionVersion {
  id: string;
  requirementId: string;
  version: number;
  decomposedAt: Date;
  themeCount: number;
  featureCount: number;
  arCount: number;
  questionCount: number;
  s3Key: string;
  createdBy?: string;
}

/**
 * Storage result from save operation
 */
export interface StorageResult {
  versionId: string;
  version: number;
  s3Key: string;
  recordCounts: {
    features: number;
    atomicRequirements: number;
    questions: number;
  };
}

/**
 * Version comparison result
 */
export interface VersionComparison {
  added: {
    features: FeatureCandidate[];
    requirements: AtomicRequirement[];
  };
  removed: {
    features: FeatureCandidate[];
    requirements: AtomicRequirement[];
  };
  modified: {
    features: Array<{ previous: FeatureCandidate; current: FeatureCandidate }>;
  };
}

/**
 * Service for storing and retrieving decomposition results
 */
export class DecompositionStorageService {
  private storageService: StorageService;
  private db: DatabaseClient;
  private bucket: string;

  constructor(storageService?: StorageService, db?: DatabaseClient, bucket?: string) {
    this.bucket = bucket || process.env.S3_BUCKET || 'entropy-artifacts';
    this.storageService = storageService || createStorageService(undefined, this.bucket);
    this.db = db || getDatabase();
  }

  /**
   * Initialize database connection
   */
  async init(): Promise<void> {
    await this.db.connect();
  }

  /**
   * Store decomposition results with versioning
   */
  async store(
    requirementId: string,
    projectId: string,
    clientId: string,
    decomposition: DecompositionResult,
    _userId?: string
  ): Promise<StorageResult> {
    await this.init();

    // Get current version number
    const latestVersion = await this.getLatestVersion(requirementId);
    const newVersion = latestVersion ? latestVersion.version + 1 : 1;

    // Generate S3 paths
    const basePath = `clients/${clientId}/projects/${projectId}/requirements/${requirementId}/decompositions/v${newVersion}`;
    const resultKey = `${basePath}/result.json`;

    // Use transaction for atomicity
    const result = await this.db.withTransaction(async (client) => {
      // Create decomposition version record
      const versionId = randomUUID();
      await client.query(
        `INSERT INTO decomposition_results (
          id, requirement_id, themes, atomic_requirements,
          feature_candidates, clarification_questions,
          output_s3_key, processing_time_ms, model_used
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          versionId,
          requirementId,
          JSON.stringify(decomposition.themes),
          JSON.stringify(decomposition.atomicRequirements),
          JSON.stringify(decomposition.featureCandidates),
          JSON.stringify(decomposition.clarificationQuestions),
          resultKey,
          decomposition.processingTimeMs,
          decomposition.model,
        ]
      );

      // Create feature records
      const featureIds: string[] = [];
      for (const candidate of decomposition.featureCandidates) {
        const featureId = randomUUID();
        featureIds.push(featureId);

        await client.query(
          `INSERT INTO features (
            id, requirement_id, project_id, title, description,
            status, priority_score, theme, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            featureId,
            requirementId,
            projectId,
            candidate.title,
            candidate.description,
            'draft',
            candidate.suggestedPriority || 5,
            candidate.theme,
            JSON.stringify({
              atomicRequirementIds: candidate.atomicRequirementIds,
              estimatedComplexity: candidate.estimatedComplexity,
              decompositionVersion: newVersion,
            }),
          ]
        );

        // Create atomic requirement records for this feature
        const featureARs = decomposition.atomicRequirements.filter(
          (ar) => candidate.atomicRequirementIds.includes(ar.id)
        );

        for (let i = 0; i < featureARs.length; i++) {
          const ar = featureARs[i]!;
          await client.query(
            `INSERT INTO atomic_requirements (
              id, feature_id, text, theme, clarity_score,
              dependencies, sequence_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              ar.id || randomUUID(),
              featureId,
              ar.text,
              ar.theme,
              ar.clarityScore,
              ar.dependencies || [],
              i,
            ]
          );
        }

        // Create clarification questions for this feature
        const featureQuestions = decomposition.clarificationQuestions.filter(
          (q) => q.featureId === candidate.title || !q.featureId
        );

        for (const q of featureQuestions) {
          await client.query(
            `INSERT INTO clarification_questions (
              id, feature_id, question, question_type,
              options, priority
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING`,
            [
              q.id || randomUUID(),
              featureId,
              q.question,
              q.questionType,
              JSON.stringify(q.options || []),
              q.priority,
            ]
          );
        }
      }

      return { versionId, featureIds };
    });

    // Store to S3 (outside transaction)
    await this.storeToS3(basePath, decomposition);

    return {
      versionId: result.versionId,
      version: newVersion,
      s3Key: resultKey,
      recordCounts: {
        features: decomposition.featureCandidates.length,
        atomicRequirements: decomposition.atomicRequirements.length,
        questions: decomposition.clarificationQuestions.length,
      },
    };
  }

  /**
   * Store decomposition to S3
   */
  private async storeToS3(basePath: string, decomposition: DecompositionResult): Promise<void> {
    // Store full result
    await this.storageService.uploadJson(
      `${basePath}/result.json`,
      decomposition,
      {},
      this.bucket
    );

    // Store themes separately
    await this.storageService.uploadJson(
      `${basePath}/themes.json`,
      decomposition.themes,
      {},
      this.bucket
    );

    // Store features separately
    await this.storageService.uploadJson(
      `${basePath}/features.json`,
      decomposition.featureCandidates,
      {},
      this.bucket
    );

    // Store questions separately
    await this.storageService.uploadJson(
      `${basePath}/questions.json`,
      decomposition.clarificationQuestions,
      {},
      this.bucket
    );
  }

  /**
   * Get the latest decomposition version for a requirement
   */
  async getLatestVersion(requirementId: string): Promise<DecompositionVersion | null> {
    await this.init();

    const row = await this.db.queryOne(
      `SELECT id, requirement_id, output_s3_key, processing_time_ms, created_at,
              json_array_length(themes::json) as theme_count,
              json_array_length(atomic_requirements::json) as ar_count,
              json_array_length(feature_candidates::json) as feature_count,
              json_array_length(clarification_questions::json) as question_count
       FROM decomposition_results
       WHERE requirement_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [requirementId]
    );

    if (!row) {
      return null;
    }

    // Extract version from S3 key (format: .../decompositions/v{version}/result.json)
    const s3Key = row.output_s3_key as string;
    const versionMatch = s3Key.match(/\/v(\d+)\//);
    const version = versionMatch?.[1] ? parseInt(versionMatch[1], 10) : 1;

    return {
      id: row.id as string,
      requirementId: row.requirement_id as string,
      version,
      decomposedAt: row.created_at as Date,
      themeCount: parseInt(row.theme_count as string, 10) || 0,
      featureCount: parseInt(row.feature_count as string, 10) || 0,
      arCount: parseInt(row.ar_count as string, 10) || 0,
      questionCount: parseInt(row.question_count as string, 10) || 0,
      s3Key,
    };
  }

  /**
   * Get all decomposition versions for a requirement
   */
  async getVersionHistory(requirementId: string): Promise<DecompositionVersion[]> {
    await this.init();

    const rows = await this.db.queryAll(
      `SELECT id, requirement_id, output_s3_key, created_at,
              json_array_length(themes::json) as theme_count,
              json_array_length(atomic_requirements::json) as ar_count,
              json_array_length(feature_candidates::json) as feature_count,
              json_array_length(clarification_questions::json) as question_count
       FROM decomposition_results
       WHERE requirement_id = $1
       ORDER BY created_at DESC`,
      [requirementId]
    );

    return rows.map((row, index) => {
      const s3Key = row.output_s3_key as string;
      const versionMatch = s3Key.match(/\/v(\d+)\//);
      const version = versionMatch?.[1] ? parseInt(versionMatch[1], 10) : rows.length - index;

      return {
        id: row.id as string,
        requirementId: row.requirement_id as string,
        version,
        decomposedAt: row.created_at as Date,
        themeCount: parseInt(row.theme_count as string, 10) || 0,
        featureCount: parseInt(row.feature_count as string, 10) || 0,
        arCount: parseInt(row.ar_count as string, 10) || 0,
        questionCount: parseInt(row.question_count as string, 10) || 0,
        s3Key,
      };
    });
  }

  /**
   * Get decomposition result by version
   */
  async getByVersion(
    requirementId: string,
    version: number
  ): Promise<DecompositionResult | null> {
    await this.init();

    const row = await this.db.queryOne(
      `SELECT themes, atomic_requirements, feature_candidates,
              clarification_questions, processing_time_ms, model_used
       FROM decomposition_results
       WHERE requirement_id = $1
       ORDER BY created_at DESC
       LIMIT 1 OFFSET $2`,
      [requirementId, version - 1] // Offset by version - 1 to get correct version
    );

    if (!row) {
      return null;
    }

    return {
      requirementId,
      themes: row.themes as Theme[],
      atomicRequirements: row.atomic_requirements as AtomicRequirement[],
      featureCandidates: row.feature_candidates as FeatureCandidate[],
      clarificationQuestions: row.clarification_questions as ClarificationQuestion[],
      processingTimeMs: row.processing_time_ms as number,
      model: row.model_used as string,
    };
  }

  /**
   * Get decomposition result from S3
   */
  async getFromS3(s3Key: string): Promise<DecompositionResult | null> {
    const result = await this.storageService.downloadJson<DecompositionResult>(
      s3Key,
      this.bucket
    );
    return result;
  }

  /**
   * Compare two decomposition versions
   */
  async compareVersions(
    requirementId: string,
    versionA: number,
    versionB: number
  ): Promise<VersionComparison> {
    const [a, b] = await Promise.all([
      this.getByVersion(requirementId, versionA),
      this.getByVersion(requirementId, versionB),
    ]);

    if (!a || !b) {
      throw new Error('One or both versions not found');
    }

    // Find added features (in B but not in A)
    const addedFeatures = b.featureCandidates.filter(
      (bf) => !a.featureCandidates.some((af) => af.title === bf.title)
    );

    // Find removed features (in A but not in B)
    const removedFeatures = a.featureCandidates.filter(
      (af) => !b.featureCandidates.some((bf) => bf.title === af.title)
    );

    // Find added requirements
    const addedRequirements = b.atomicRequirements.filter(
      (br) => !a.atomicRequirements.some((ar) => ar.text === br.text)
    );

    // Find removed requirements
    const removedRequirements = a.atomicRequirements.filter(
      (ar) => !b.atomicRequirements.some((br) => br.text === ar.text)
    );

    // Find modified features (same title, different content)
    const modifiedFeatures: Array<{ previous: FeatureCandidate; current: FeatureCandidate }> = [];
    for (const bf of b.featureCandidates) {
      const af = a.featureCandidates.find((f) => f.title === bf.title);
      if (af && JSON.stringify(af) !== JSON.stringify(bf)) {
        modifiedFeatures.push({ previous: af, current: bf });
      }
    }

    return {
      added: {
        features: addedFeatures,
        requirements: addedRequirements,
      },
      removed: {
        features: removedFeatures,
        requirements: removedRequirements,
      },
      modified: {
        features: modifiedFeatures,
      },
    };
  }

  /**
   * Delete a specific decomposition version
   */
  async deleteVersion(_requirementId: string, versionId: string): Promise<void> {
    await this.init();

    // Get the S3 key before deletion
    const row = await this.db.queryOne(
      `SELECT output_s3_key FROM decomposition_results WHERE id = $1`,
      [versionId]
    );

    if (row) {
      // Delete from database
      await this.db.query(
        `DELETE FROM decomposition_results WHERE id = $1`,
        [versionId]
      );

      // Delete from S3
      const s3Key = row.output_s3_key as string;
      const basePath = s3Key.replace('/result.json', '');

      try {
        await this.storageService.delete(`${basePath}/result.json`, this.bucket);
        await this.storageService.delete(`${basePath}/themes.json`, this.bucket);
        await this.storageService.delete(`${basePath}/features.json`, this.bucket);
        await this.storageService.delete(`${basePath}/questions.json`, this.bucket);
      } catch {
        // Ignore S3 deletion errors
      }
    }
  }
}

/**
 * Create a decomposition storage service instance
 */
export function createDecompositionStorageService(
  storageService?: StorageService,
  db?: DatabaseClient,
  bucket?: string
): DecompositionStorageService {
  return new DecompositionStorageService(storageService, db, bucket);
}
