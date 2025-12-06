// Intake routes for file uploads and requirement processing

import { randomUUID } from 'crypto';
import {
  createLogger,
  getDatabase,
  RequirementRepository,
  createTextExtractionService,
  createStorageService,
} from '@entropy/shared';
import { Router, type IRouter, type Request } from 'express';
import multer from 'multer';

const logger = createLogger('intake');

export const intakeRouter: IRouter = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
    ];
    const allowedExtensions = ['.pdf', '.docx', '.txt', '.md'];

    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    const isAllowedMime = allowedMimes.includes(file.mimetype);
    const isAllowedExt = allowedExtensions.includes(ext);

    if (isAllowedMime || isAllowedExt) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Allowed types: ${allowedExtensions.join(', ')}`));
    }
  },
});

// Initialize services lazily
let requirementRepo: RequirementRepository | null = null;

async function getRequirementRepository(): Promise<RequirementRepository> {
  if (!requirementRepo) {
    const db = getDatabase();
    await db.connect();
    requirementRepo = new RequirementRepository(db);
  }
  return requirementRepo;
}

/**
 * Process uploaded document: upload to S3, extract text, create requirement
 */
async function processDocument(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  projectId: string,
  uploadedBy: string
): Promise<{ requirementId: string; status: string }> {
  const storageService = createStorageService();
  const repo = await getRequirementRepository();

  const clientId = process.env.DEFAULT_CLIENT_ID || 'default';
  const uploadBucket = process.env.S3_BUCKET_UPLOADS || 'entropy-uploads';

  // Generate unique ID for this requirement
  const requirementId = randomUUID();

  // 1. Upload original file to S3
  const s3Key = `clients/${clientId}/projects/${projectId}/requirements/${requirementId}/original/${originalName}`;
  await storageService.upload(s3Key, buffer, { contentType: mimeType }, uploadBucket);

  logger.info('File uploaded to S3', { s3Key, size: buffer.length });

  // 2. Create requirement record in database
  const requirement = await repo.createRequirement(
    {
      projectId,
      title: originalName.replace(/\.[^.]+$/, ''), // Remove extension
      sourceFileS3Key: s3Key,
    },
    uploadedBy
  );

  logger.info('Requirement created', { requirementId: requirement.id });

  // 3. Start async text extraction (non-blocking)
  extractTextAsync(requirement.id, buffer, mimeType, projectId, clientId).catch((error) => {
    logger.error('Text extraction failed', {
      requirementId: requirement.id,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return {
    requirementId: requirement.id,
    status: 'processing',
  };
}

/**
 * Async text extraction that updates requirement status
 */
async function extractTextAsync(
  requirementId: string,
  buffer: Buffer,
  mimeType: string,
  projectId: string,
  clientId: string
): Promise<void> {
  const repo = await getRequirementRepository();
  const storageService = createStorageService();
  const textExtractionService = createTextExtractionService(storageService);

  try {
    // Update status to extracting
    await repo.updateStatus(requirementId, 'extracting');

    // Extract text from document
    const extractionResult = await textExtractionService.extract(buffer, mimeType);

    // Save extracted text to S3
    const { textKey } = await textExtractionService.saveExtractedText(
      requirementId,
      projectId,
      clientId,
      extractionResult
    );

    // Update requirement with extracted text location
    await repo.updateExtractedText(requirementId, textKey);

    logger.info('Text extraction completed', {
      requirementId,
      wordCount: extractionResult.wordCount,
      pageCount: extractionResult.pageCount,
    });
  } catch (error) {
    logger.error('Extraction failed', {
      requirementId,
      error: error instanceof Error ? error.message : String(error),
    });
    await repo.markFailed(
      requirementId,
      error instanceof Error ? error.message : 'Extraction failed'
    );
  }
}

/**
 * POST /api/v1/intake/upload
 * Upload a requirement document
 */
intakeRouter.post('/upload', upload.single('file'), async (req: Request, res) => {
  try {
    if (!req.file) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No file provided',
        },
      });
      return;
    }

    const { projectId } = req.body;
    if (!projectId) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'projectId is required',
        },
      });
      return;
    }

    // Get user ID from auth or use default
    const uploadedBy = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000001';

    logger.info('File upload started', {
      filename: req.file.originalname,
      size: req.file.size,
      projectId,
    });

    const result = await processDocument(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      projectId,
      uploadedBy
    );

    res.json({
      id: result.requirementId,
      filename: req.file.originalname,
      size: req.file.size,
      status: result.status,
      message: 'File uploaded successfully. Processing started.',
    });
  } catch (error) {
    logger.error('Upload failed', { error });
    res.status(500).json({
      error: {
        code: 'UPLOAD_FAILED',
        message: error instanceof Error ? error.message : 'Upload failed',
      },
    });
  }
});

/**
 * POST /api/v1/intake/submit-text
 * Submit requirement as plain text
 */
intakeRouter.post('/submit-text', async (req: Request, res) => {
  try {
    const { projectId, title, text } = req.body;

    if (!projectId || !title || !text) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'projectId, title, and text are required',
        },
      });
      return;
    }

    const uploadedBy = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000001';
    const buffer = Buffer.from(text, 'utf-8');

    const result = await processDocument(
      buffer,
      `${title}.txt`,
      'text/plain',
      projectId,
      uploadedBy
    );

    res.json({
      id: result.requirementId,
      title,
      status: result.status,
      message: 'Text submitted successfully. Processing started.',
    });
  } catch (error) {
    logger.error('Text submission failed', { error });
    res.status(500).json({
      error: {
        code: 'SUBMISSION_FAILED',
        message: error instanceof Error ? error.message : 'Submission failed',
      },
    });
  }
});

/**
 * GET /api/v1/intake/uploads
 * List all uploads/requirements for a project
 */
intakeRouter.get('/uploads', async (req, res, next) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'projectId query parameter is required',
        },
      });
      return;
    }

    const repo = await getRequirementRepository();
    const requirements = await repo.findByProjectId(projectId as string);

    const uploads = requirements.map((r) => ({
      id: r.id,
      title: r.title,
      filename: r.sourceFileS3Key?.split('/').pop() || r.title,
      status: r.status,
      uploadedAt: r.createdAt,
      processedAt: r.updatedAt !== r.createdAt ? r.updatedAt : undefined,
      error: r.errorMessage,
    }));

    res.json({ uploads });
  } catch (error) {
    logger.error('Failed to list uploads', { error });
    next(error);
  }
});

/**
 * GET /api/v1/intake/uploads/:id
 * Get upload/requirement status
 */
intakeRouter.get('/uploads/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const repo = await getRequirementRepository();
    const requirement = await repo.findById(id);

    if (!requirement) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Upload not found',
        },
      });
      return;
    }

    res.json({
      id: requirement.id,
      title: requirement.title,
      filename: requirement.sourceFileS3Key?.split('/').pop() || requirement.title,
      status: requirement.status,
      type: requirement.type,
      uploadedAt: requirement.createdAt,
      processedAt:
        requirement.updatedAt !== requirement.createdAt ? requirement.updatedAt : undefined,
      error: requirement.errorMessage,
    });
  } catch (error) {
    logger.error('Failed to get upload status', { error });
    next(error);
  }
});

/**
 * DELETE /api/v1/intake/uploads/:id
 * Delete an upload/requirement
 */
intakeRouter.delete('/uploads/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const repo = await getRequirementRepository();
    const requirement = await repo.findById(id);

    if (!requirement) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Upload not found',
        },
      });
      return;
    }

    // Delete from database
    await repo.delete(id);

    logger.info('Upload deleted', { id });

    res.json({ success: true, message: 'Upload deleted' });
  } catch (error) {
    logger.error('Failed to delete upload', { error });
    next(error);
  }
});

/**
 * POST /api/v1/intake/uploads/:id/reprocess
 * Reprocess a failed upload
 */
intakeRouter.post('/uploads/:id/reprocess', async (req, res, next) => {
  try {
    const { id } = req.params;

    const repo = await getRequirementRepository();
    const requirement = await repo.findById(id);

    if (!requirement) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Upload not found',
        },
      });
      return;
    }

    if (requirement.status !== 'failed') {
      res.status(400).json({
        error: {
          code: 'INVALID_STATE',
          message: 'Only failed uploads can be reprocessed',
        },
      });
      return;
    }

    // Download original file from S3 and reprocess
    const storageService = createStorageService();
    const uploadBucket = process.env.S3_BUCKET_UPLOADS || 'entropy-uploads';

    if (!requirement.sourceFileS3Key) {
      res.status(400).json({
        error: {
          code: 'MISSING_SOURCE',
          message: 'Source file not found for reprocessing',
        },
      });
      return;
    }

    const fileResult = await storageService.download(requirement.sourceFileS3Key, uploadBucket);
    if (!fileResult) {
      res.status(404).json({
        error: {
          code: 'SOURCE_NOT_FOUND',
          message: 'Source file not found in storage',
        },
      });
      return;
    }

    const clientId = process.env.DEFAULT_CLIENT_ID || 'default';

    // Infer MIME type from filename
    const filename = requirement.sourceFileS3Key.split('/').pop() || '';
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeTypeMap: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain',
      md: 'text/markdown',
    };
    const mimeType = mimeTypeMap[ext] || 'text/plain';

    // Start reprocessing
    extractTextAsync(id, fileResult.content, mimeType, requirement.projectId, clientId).catch(
      (error) => {
        logger.error('Reprocessing failed', {
          requirementId: id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    );

    logger.info('Reprocessing started', { id });

    res.json({
      id,
      status: 'processing',
      message: 'Reprocessing started',
    });
  } catch (error) {
    logger.error('Failed to start reprocessing', { error });
    next(error);
  }
});
