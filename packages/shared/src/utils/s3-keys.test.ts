// Tests for S3 Key Utilities

import { describe, it, expect } from 'vitest';
import { S3KeyBuilder, getS3BucketName, detectContentType } from './s3-keys.js';

describe('S3KeyBuilder', () => {
  const clientId = 'client-123';
  const projectId = 'proj-456';
  const requirementId = 'req-789';
  const featureId = 'feat-001';

  describe('uploadKey', () => {
    it('should generate correct upload key', () => {
      const key = S3KeyBuilder.uploadKey(clientId, projectId, requirementId, 'document.pdf');
      expect(key).toBe(
        'clients/client-123/projects/proj-456/requirements/req-789/original/document.pdf'
      );
    });
  });

  describe('extractedTextKey', () => {
    it('should generate correct extracted text key', () => {
      const key = S3KeyBuilder.extractedTextKey(clientId, projectId, requirementId);
      expect(key).toBe(
        'clients/client-123/projects/proj-456/requirements/req-789/processed/extracted_text.txt'
      );
    });
  });

  describe('artifactKey', () => {
    it('should generate correct decomposition artifact key', () => {
      const key = S3KeyBuilder.artifactKey(
        clientId,
        projectId,
        featureId,
        1,
        'decomposition',
        'result.json'
      );
      expect(key).toBe(
        'clients/client-123/projects/proj-456/features/feat-001/v1/01_decomposition/result.json'
      );
    });

    it('should generate correct impact analysis artifact key', () => {
      const key = S3KeyBuilder.artifactKey(
        clientId,
        projectId,
        featureId,
        2,
        'impact_analysis',
        'report.json'
      );
      expect(key).toBe(
        'clients/client-123/projects/proj-456/features/feat-001/v2/02_impact_analysis/report.json'
      );
    });

    it('should generate correct living spec artifact key', () => {
      const key = S3KeyBuilder.artifactKey(
        clientId,
        projectId,
        featureId,
        1,
        'living_spec',
        'spec.md'
      );
      expect(key).toBe(
        'clients/client-123/projects/proj-456/features/feat-001/v1/03_living_spec/spec.md'
      );
    });

    it('should generate correct code draft artifact key', () => {
      const key = S3KeyBuilder.artifactKey(
        clientId,
        projectId,
        featureId,
        1,
        'code_draft',
        'code.zip'
      );
      expect(key).toBe(
        'clients/client-123/projects/proj-456/features/feat-001/v1/04_code_draft/code.zip'
      );
    });
  });

  describe('decompositionKey', () => {
    it('should generate correct decomposition key with default filename', () => {
      const key = S3KeyBuilder.decompositionKey(clientId, projectId, requirementId);
      expect(key).toBe(
        'clients/client-123/projects/proj-456/requirements/req-789/01_decomposition/result.json'
      );
    });

    it('should generate correct decomposition key with custom filename', () => {
      const key = S3KeyBuilder.decompositionKey(clientId, projectId, requirementId, 'themes.json');
      expect(key).toBe(
        'clients/client-123/projects/proj-456/requirements/req-789/01_decomposition/themes.json'
      );
    });
  });

  describe('promptKey', () => {
    it('should generate correct prompt key', () => {
      const key = S3KeyBuilder.promptKey('decomposer', 'v1.0.0', 'system_prompt.md');
      expect(key).toBe('agents/decomposer/v1.0.0/system_prompt.md');
    });
  });

  describe('systemPromptKey', () => {
    it('should generate correct system prompt key', () => {
      const key = S3KeyBuilder.systemPromptKey('classifier', 'v2.0.0');
      expect(key).toBe('agents/classifier/v2.0.0/system_prompt.md');
    });
  });

  describe('userPromptTemplateKey', () => {
    it('should generate correct user prompt template key', () => {
      const key = S3KeyBuilder.userPromptTemplateKey('impact_analyzer', 'v1.0.0');
      expect(key).toBe('agents/impact_analyzer/v1.0.0/user_prompt_template.md');
    });
  });

  describe('configKey', () => {
    it('should generate correct config key', () => {
      const key = S3KeyBuilder.configKey('model_pricing.json');
      expect(key).toBe('config/model_pricing.json');
    });
  });

  describe('prefix methods', () => {
    it('should generate correct requirement prefix', () => {
      const prefix = S3KeyBuilder.requirementPrefix(clientId, projectId, requirementId);
      expect(prefix).toBe('clients/client-123/projects/proj-456/requirements/req-789/');
    });

    it('should generate correct feature prefix', () => {
      const prefix = S3KeyBuilder.featurePrefix(clientId, projectId, featureId);
      expect(prefix).toBe('clients/client-123/projects/proj-456/features/feat-001/');
    });

    it('should generate correct project features prefix', () => {
      const prefix = S3KeyBuilder.projectFeaturesPrefix(clientId, projectId);
      expect(prefix).toBe('clients/client-123/projects/proj-456/features/');
    });

    it('should generate correct project requirements prefix', () => {
      const prefix = S3KeyBuilder.projectRequirementsPrefix(clientId, projectId);
      expect(prefix).toBe('clients/client-123/projects/proj-456/requirements/');
    });

    it('should generate correct agent prompts prefix', () => {
      const prefix = S3KeyBuilder.agentPromptsPrefix('decomposer');
      expect(prefix).toBe('agents/decomposer/');
    });
  });

  describe('parseKey', () => {
    it('should parse requirement key correctly', () => {
      const key = 'clients/client-123/projects/proj-456/requirements/req-789/original/doc.pdf';
      const parsed = S3KeyBuilder.parseKey(key);
      expect(parsed).toEqual({
        clientId: 'client-123',
        projectId: 'proj-456',
        requirementId: 'req-789',
        filename: 'doc.pdf',
      });
    });

    it('should parse feature key with version correctly', () => {
      const key =
        'clients/client-123/projects/proj-456/features/feat-001/v2/01_decomposition/result.json';
      const parsed = S3KeyBuilder.parseKey(key);
      expect(parsed).toEqual({
        clientId: 'client-123',
        projectId: 'proj-456',
        featureId: 'feat-001',
        version: 2,
        filename: 'result.json',
      });
    });

    it('should handle non-standard paths', () => {
      const key = 'config/model_pricing.json';
      const parsed = S3KeyBuilder.parseKey(key);
      expect(parsed).toEqual({
        filename: 'model_pricing.json',
      });
    });
  });

  describe('isValidKey', () => {
    it('should return true for valid keys', () => {
      expect(S3KeyBuilder.isValidKey('clients/test/file.json')).toBe(true);
      expect(S3KeyBuilder.isValidKey('path/to/file-name_v1.txt')).toBe(true);
    });

    it('should return false for invalid keys', () => {
      expect(S3KeyBuilder.isValidKey('')).toBe(false);
      expect(S3KeyBuilder.isValidKey('/leading-slash')).toBe(false);
      expect(S3KeyBuilder.isValidKey('trailing-slash/')).toBe(false);
      expect(S3KeyBuilder.isValidKey('double//slash')).toBe(false);
      expect(S3KeyBuilder.isValidKey('special@chars!')).toBe(false);
    });
  });

  describe('sanitizeFilename', () => {
    it('should sanitize special characters', () => {
      expect(S3KeyBuilder.sanitizeFilename('file@name!.pdf')).toBe('file_name_.pdf');
    });

    it('should remove consecutive underscores', () => {
      expect(S3KeyBuilder.sanitizeFilename('file__name.pdf')).toBe('file_name.pdf');
    });

    it('should remove leading/trailing underscores', () => {
      expect(S3KeyBuilder.sanitizeFilename('_filename_')).toBe('filename');
    });

    it('should preserve valid characters', () => {
      expect(S3KeyBuilder.sanitizeFilename('valid-file_name.v1.pdf')).toBe(
        'valid-file_name.v1.pdf'
      );
    });
  });
});

describe('getS3BucketName', () => {
  it('should return correct bucket name for each type', () => {
    expect(getS3BucketName('uploads', 'staging')).toBe('entropy-staging-uploads');
    expect(getS3BucketName('artifacts', 'production')).toBe('entropy-production-artifacts');
    expect(getS3BucketName('prompts', 'dev')).toBe('entropy-dev-prompts');
    expect(getS3BucketName('config', 'staging')).toBe('entropy-staging-config');
  });
});

describe('detectContentType', () => {
  it('should detect common file types', () => {
    expect(detectContentType('document.pdf')).toBe('application/pdf');
    expect(detectContentType('data.json')).toBe('application/json');
    expect(detectContentType('readme.md')).toBe('text/markdown');
    expect(detectContentType('notes.txt')).toBe('text/plain');
    expect(detectContentType('report.docx')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  });

  it('should detect image types', () => {
    expect(detectContentType('image.png')).toBe('image/png');
    expect(detectContentType('photo.jpg')).toBe('image/jpeg');
    expect(detectContentType('photo.jpeg')).toBe('image/jpeg');
    expect(detectContentType('graphic.gif')).toBe('image/gif');
    expect(detectContentType('icon.svg')).toBe('image/svg+xml');
  });

  it('should return octet-stream for unknown types', () => {
    expect(detectContentType('file.unknown')).toBe('application/octet-stream');
    expect(detectContentType('noextension')).toBe('application/octet-stream');
  });

  it('should handle case-insensitivity', () => {
    expect(detectContentType('FILE.PDF')).toBe('application/pdf');
    expect(detectContentType('DATA.JSON')).toBe('application/json');
  });
});
