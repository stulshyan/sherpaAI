// S3 Key Builder Utilities for Entropy Platform
// Provides consistent S3 key generation across the application

import { S3_PATHS } from '../constants/index.js';

/**
 * S3 bucket types
 */
export type S3BucketType = 'uploads' | 'artifacts' | 'prompts' | 'config';

/**
 * Loop types for artifact organization
 */
export type LoopType = 'loop_0' | 'loop_a' | 'loop_b' | 'loop_c';

/**
 * Artifact types corresponding to each loop
 */
export type ArtifactType =
  | 'decomposition'
  | 'impact_analysis'
  | 'living_spec'
  | 'code_draft'
  | 'test_results'
  | 'validation_report';

/**
 * S3 Key Builder utility class
 * Provides consistent S3 key generation following the bucket structure
 */
export class S3KeyBuilder {
  /**
   * Generate S3 key for uploaded requirement document
   * Pattern: clients/{clientId}/projects/{projectId}/requirements/{reqId}/original/{filename}
   */
  static uploadKey(
    clientId: string,
    projectId: string,
    requirementId: string,
    filename: string
  ): string {
    return `clients/${clientId}/projects/${projectId}/requirements/${requirementId}/${S3_PATHS.ORIGINAL}/${filename}`;
  }

  /**
   * Generate S3 key for extracted text from requirement
   * Pattern: clients/{clientId}/projects/{projectId}/requirements/{reqId}/processed/extracted_text.txt
   */
  static extractedTextKey(clientId: string, projectId: string, requirementId: string): string {
    return `clients/${clientId}/projects/${projectId}/requirements/${requirementId}/${S3_PATHS.PROCESSED}/extracted_text.txt`;
  }

  /**
   * Generate S3 key for feature artifacts
   * Pattern: clients/{clientId}/projects/{projectId}/features/{featureId}/v{version}/{loop}/{filename}
   */
  static artifactKey(
    clientId: string,
    projectId: string,
    featureId: string,
    version: number,
    artifactType: ArtifactType,
    filename: string
  ): string {
    const loopPath = S3KeyBuilder.getArtifactPath(artifactType);
    return `clients/${clientId}/projects/${projectId}/features/${featureId}/v${version}/${loopPath}/${filename}`;
  }

  /**
   * Generate S3 key for decomposition results
   * Pattern: clients/{clientId}/projects/{projectId}/requirements/{reqId}/decomposition/result.json
   */
  static decompositionKey(
    clientId: string,
    projectId: string,
    requirementId: string,
    filename: string = 'result.json'
  ): string {
    return `clients/${clientId}/projects/${projectId}/requirements/${requirementId}/${S3_PATHS.DECOMPOSITION}/${filename}`;
  }

  /**
   * Generate S3 key for agent prompts
   * Pattern: agents/{agentType}/{version}/{file}
   */
  static promptKey(agentType: string, version: string, filename: string): string {
    return `agents/${agentType}/${version}/${filename}`;
  }

  /**
   * Generate S3 key for system prompt
   * Pattern: agents/{agentType}/{version}/system_prompt.md
   */
  static systemPromptKey(agentType: string, version: string): string {
    return S3KeyBuilder.promptKey(agentType, version, 'system_prompt.md');
  }

  /**
   * Generate S3 key for user prompt template
   * Pattern: agents/{agentType}/{version}/user_prompt_template.md
   */
  static userPromptTemplateKey(agentType: string, version: string): string {
    return S3KeyBuilder.promptKey(agentType, version, 'user_prompt_template.md');
  }

  /**
   * Generate S3 key for configuration files
   * Pattern: config/{filename}
   */
  static configKey(filename: string): string {
    return `config/${filename}`;
  }

  /**
   * Generate S3 prefix for listing requirement files
   * Pattern: clients/{clientId}/projects/{projectId}/requirements/{reqId}/
   */
  static requirementPrefix(clientId: string, projectId: string, requirementId: string): string {
    return `clients/${clientId}/projects/${projectId}/requirements/${requirementId}/`;
  }

  /**
   * Generate S3 prefix for listing feature artifacts
   * Pattern: clients/{clientId}/projects/{projectId}/features/{featureId}/
   */
  static featurePrefix(clientId: string, projectId: string, featureId: string): string {
    return `clients/${clientId}/projects/${projectId}/features/${featureId}/`;
  }

  /**
   * Generate S3 prefix for listing all features in a project
   * Pattern: clients/{clientId}/projects/{projectId}/features/
   */
  static projectFeaturesPrefix(clientId: string, projectId: string): string {
    return `clients/${clientId}/projects/${projectId}/features/`;
  }

  /**
   * Generate S3 prefix for listing all requirements in a project
   * Pattern: clients/{clientId}/projects/{projectId}/requirements/
   */
  static projectRequirementsPrefix(clientId: string, projectId: string): string {
    return `clients/${clientId}/projects/${projectId}/requirements/`;
  }

  /**
   * Generate S3 prefix for listing all agent prompts
   * Pattern: agents/{agentType}/
   */
  static agentPromptsPrefix(agentType: string): string {
    return `agents/${agentType}/`;
  }

  /**
   * Parse S3 key to extract client, project, and resource IDs
   */
  static parseKey(key: string): {
    clientId?: string;
    projectId?: string;
    requirementId?: string;
    featureId?: string;
    version?: number;
    filename?: string;
  } {
    const parts = key.split('/');
    const result: {
      clientId?: string;
      projectId?: string;
      requirementId?: string;
      featureId?: string;
      version?: number;
      filename?: string;
    } = {};

    // Parse clients/{clientId}/projects/{projectId}/...
    if (parts[0] === 'clients' && parts.length >= 4) {
      result.clientId = parts[1] ?? undefined;
      if (parts[2] === 'projects') {
        result.projectId = parts[3] ?? undefined;

        // Parse requirements/{reqId}/... or features/{featureId}/...
        if (parts.length >= 6) {
          if (parts[4] === 'requirements') {
            result.requirementId = parts[5] ?? undefined;
          } else if (parts[4] === 'features') {
            result.featureId = parts[5] ?? undefined;

            // Parse version if present
            const versionPart = parts[6];
            if (parts.length >= 7 && versionPart?.startsWith('v')) {
              result.version = parseInt(versionPart.substring(1), 10);
            }
          }
        }
      }
    }

    // Get filename (last part)
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart.includes('.')) {
        result.filename = lastPart;
      }
    }

    return result;
  }

  /**
   * Get artifact path for a specific artifact type
   */
  private static getArtifactPath(artifactType: ArtifactType): string {
    const artifactPaths: Record<ArtifactType, string> = {
      decomposition: S3_PATHS.DECOMPOSITION,
      impact_analysis: S3_PATHS.IMPACT_ANALYSIS,
      living_spec: S3_PATHS.LIVING_SPEC,
      code_draft: S3_PATHS.CODE_DRAFT,
      test_results: '05_test_results',
      validation_report: '06_validation',
    };
    return artifactPaths[artifactType];
  }

  /**
   * Validate that an S3 key follows the expected pattern
   */
  static isValidKey(key: string): boolean {
    if (!key || typeof key !== 'string') {
      return false;
    }

    // Must not start or end with slash
    if (key.startsWith('/') || key.endsWith('/')) {
      return false;
    }

    // Must not contain consecutive slashes
    if (key.includes('//')) {
      return false;
    }

    // Must not contain special characters (except allowed ones)
    const invalidChars = /[^a-zA-Z0-9\-_./]/;
    if (invalidChars.test(key)) {
      return false;
    }

    return true;
  }

  /**
   * Sanitize a filename for S3 storage
   */
  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9\-_./]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '');
  }
}

/**
 * Get the appropriate S3 bucket name based on bucket type
 */
export function getS3BucketName(bucketType: S3BucketType, environment: string): string {
  const bucketNames: Record<S3BucketType, string> = {
    uploads: `entropy-${environment}-uploads`,
    artifacts: `entropy-${environment}-artifacts`,
    prompts: `entropy-${environment}-prompts`,
    config: `entropy-${environment}-config`,
  };
  return bucketNames[bucketType];
}

/**
 * Detect content type from filename extension
 */
export function detectContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    json: 'application/json',
    md: 'text/markdown',
    txt: 'text/plain',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    ts: 'application/typescript',
    xml: 'application/xml',
    yaml: 'application/yaml',
    yml: 'application/yaml',
    zip: 'application/zip',
    tar: 'application/x-tar',
    gz: 'application/gzip',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}
