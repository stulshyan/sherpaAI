// Requirements routes for S-033 and S-038
// Handles file upload, decomposition triggers, and status tracking

import { randomUUID } from 'crypto';
import {
  createLogger,
  MAX_FILE_SIZE_BYTES,
  SUPPORTED_FILE_TYPES,
  createStorageService,
  getDatabase,
  RequirementRepository,
} from '@entropy/shared';
import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';

const logger = createLogger('requirements-routes');

export const requirementsRouter: IRouter = Router();

// Initialize services lazily
let storageService: ReturnType<typeof createStorageService> | null = null;
let requirementRepo: RequirementRepository | null = null;

function getStorageService() {
  if (!storageService) {
    const bucket = process.env.S3_BUCKET || 'entropy-artifacts';
    storageService = createStorageService(undefined, bucket);
  }
  return storageService;
}

async function getRequirementRepository() {
  if (!requirementRepo) {
    const db = getDatabase();
    await db.connect();
    requirementRepo = new RequirementRepository(db);
  }
  return requirementRepo;
}

// Magic bytes for file type validation
const MAGIC_BYTES: Record<string, Buffer[]> = {
  'application/pdf': [Buffer.from('%PDF-')],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    Buffer.from([0x50, 0x4b, 0x03, 0x04]), // PK ZIP header
  ],
  // Text files don't have reliable magic bytes
};

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    // Check MIME type
    if (SUPPORTED_FILE_TYPES.includes(file.mimetype as (typeof SUPPORTED_FILE_TYPES)[number])) {
      cb(null, true);
    } else {
      // Check file extension for markdown files
      const ext = file.originalname.toLowerCase().split('.').pop();
      if (ext === 'md' || ext === 'markdown') {
        cb(null, true);
      } else {
        cb(new Error('UNSUPPORTED_FILE_TYPE'));
      }
    }
  },
});

// Error handling for multer
function handleMulterError(
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File size exceeds maximum limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
        },
      });
      return;
    }
    res.status(400).json({
      error: {
        code: 'UPLOAD_ERROR',
        message: err.message,
      },
    });
    return;
  }

  if (err.message === 'UNSUPPORTED_FILE_TYPE') {
    res.status(415).json({
      error: {
        code: 'UNSUPPORTED_FILE_TYPE',
        message: 'File type not allowed. Allowed types: PDF, DOCX, TXT, MD',
      },
    });
    return;
  }

  next(err);
}

/**
 * Validate file content matches its declared MIME type
 */
function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const expectedMagic = MAGIC_BYTES[mimeType];

  // Text files don't have magic bytes - always valid
  if (!expectedMagic) {
    return true;
  }

  // Check if buffer starts with any of the expected magic bytes
  return expectedMagic.some((magic) => {
    if (buffer.length < magic.length) {
      return false;
    }
    return buffer.subarray(0, magic.length).equals(magic);
  });
}

/**
 * Generate unique filename with timestamp if needed
 */
function generateUniqueFilename(originalName: string, existingNames?: Set<string>): string {
  if (!existingNames || !existingNames.has(originalName)) {
    return originalName;
  }

  const ext = originalName.includes('.') ? '.' + originalName.split('.').pop() : '';
  const base = originalName.replace(ext, '');
  const timestamp = Date.now();
  return `${base}_${timestamp}${ext}`;
}

/**
 * Estimate processing time based on file size
 */
function estimateProcessingTime(fileSize: number): number {
  // Rough estimate: ~10 seconds per MB plus base time
  const mbSize = fileSize / (1024 * 1024);
  return Math.ceil(30 + mbSize * 10);
}

/**
 * POST /api/v1/requirements/upload
 * Upload a requirement document
 */
requirementsRouter.post(
  '/upload',
  upload.single('file'),
  handleMulterError,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file;
      const { projectId, title, description: _description, priority: _priority, requestedBy: _requestedBy, metadata: _metadata } = req.body;

      // Validate required fields
      if (!file) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'No file provided',
            details: { file: 'required' },
          },
        });
        return;
      }

      if (!projectId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'projectId is required',
            details: { projectId: 'required' },
          },
        });
        return;
      }

      // Validate magic bytes
      if (!validateMagicBytes(file.buffer, file.mimetype)) {
        res.status(415).json({
          error: {
            code: 'INVALID_FILE_CONTENT',
            message: 'File content does not match declared file type',
          },
        });
        return;
      }

      logger.info('Processing requirement upload', {
        projectId,
        filename: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
      });

      // Generate IDs and paths
      const requirementId = randomUUID();
      // For now, use a placeholder client ID - in production this would come from auth
      const clientId = process.env.DEFAULT_CLIENT_ID || '00000000-0000-0000-0000-000000000001';
      const filename = generateUniqueFilename(file.originalname);
      const s3Key = `clients/${clientId}/projects/${projectId}/requirements/${requirementId}/original/${filename}`;

      // Upload to S3
      const storage = getStorageService();
      const bucket = process.env.S3_BUCKET || 'entropy-artifacts';
      await storage.upload(s3Key, file.buffer, {
        contentType: file.mimetype,
        metadata: {
          requirementId,
          projectId,
          originalFilename: file.originalname,
        },
      }, bucket);

      logger.info('File uploaded to S3', { s3Key, requirementId });

      // Create database record
      const repo = await getRequirementRepository();
      // For now, use system user ID - in production this would come from auth
      const userId = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000001';

      const requirement = await repo.createRequirement(
        {
          projectId,
          title: title || file.originalname,
          sourceFileS3Key: s3Key,
        },
        userId
      );

      logger.info('Requirement record created', {
        requirementId: requirement.id,
        projectId,
        status: requirement.status,
      });

      res.status(201).json({
        requirementId: requirement.id,
        status: requirement.status,
        filename,
        fileSize: file.size,
        mimeType: file.mimetype,
        s3Key,
        uploadedAt: requirement.createdAt,
        estimatedProcessingTime: estimateProcessingTime(file.size),
        _links: {
          self: `/api/v1/requirements/${requirement.id}`,
          decompose: `/api/v1/requirements/${requirement.id}/decompose`,
          status: `/api/v1/requirements/${requirement.id}/decomposition/status`,
        },
      });
    } catch (error) {
      logger.error('Upload failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
);

/**
 * GET /api/v1/requirements/:id
 * Get requirement by ID
 */
requirementsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id!;

    const repo = await getRequirementRepository();
    const requirement = await repo.findById(id);

    if (!requirement) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Requirement ${id} not found`,
        },
      });
      return;
    }

    res.json({
      id: requirement.id,
      projectId: requirement.projectId,
      title: requirement.title,
      status: requirement.status,
      type: requirement.type,
      typeConfidence: requirement.typeConfidence,
      sourceFileS3Key: requirement.sourceFileS3Key,
      extractedTextS3Key: requirement.extractedTextS3Key,
      errorMessage: requirement.errorMessage,
      createdAt: requirement.createdAt,
      updatedAt: requirement.updatedAt,
      _links: {
        self: `/api/v1/requirements/${requirement.id}`,
        decompose: `/api/v1/requirements/${requirement.id}/decompose`,
        decomposition: `/api/v1/requirements/${requirement.id}/decomposition`,
        status: `/api/v1/requirements/${requirement.id}/decomposition/status`,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/requirements
 * List requirements for a project
 */
requirementsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, status: _status, page = '1', limit = '20' } = req.query;

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
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    const result = await repo.findByProjectIdPaginated(projectId as string, {
      page: pageNum,
      limit: limitNum,
    });

    res.json({
      requirements: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/requirements/:id/decompose
 * Start decomposition for a requirement
 */
requirementsRouter.post(
  '/:id/decompose',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id!;
      const { force = false, priority = 'normal' } = req.body;

      const repo = await getRequirementRepository();
      const requirement = await repo.findById(id);

      if (!requirement) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Requirement ${id} not found`,
          },
        });
        return;
      }

      // Check if already decomposed (idempotent behavior)
      if (requirement.status === 'decomposed' && !force) {
        res.status(200).json({
          message: 'Decomposition already exists',
          requirementId: id,
          status: requirement.status,
          _links: {
            decomposition: `/api/v1/requirements/${id}/decomposition`,
            re_decompose: `/api/v1/requirements/${id}/decompose?force=true`,
          },
        });
        return;
      }

      // Check if already in progress
      if (
        ['extracting', 'classifying', 'decomposing'].includes(requirement.status) &&
        !force
      ) {
        res.status(409).json({
          error: {
            code: 'ALREADY_PROCESSING',
            message: 'Decomposition is already in progress',
          },
          _links: {
            status: `/api/v1/requirements/${id}/decomposition/status`,
          },
        });
        return;
      }

      logger.info('Starting decomposition', {
        requirementId: id,
        force,
        priority,
        currentStatus: requirement.status,
      });

      // Update status to extracting (start of pipeline)
      await repo.updateStatus(id, 'extracting');

      // Generate job ID for tracking
      const jobId = randomUUID();

      // In production, this would queue a job to a background worker
      // For now, we return immediately and the orchestrator will pick it up
      res.status(202).json({
        jobId,
        requirementId: id,
        status: 'queued',
        estimatedDuration: estimateProcessingTime(0), // Would need file size
        pollUrl: `/api/v1/requirements/${id}/decomposition/status`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/requirements/:id/decomposition/status
 * Get decomposition status (for polling)
 */
requirementsRouter.get(
  '/:id/decomposition/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id!;

      const repo = await getRequirementRepository();
      const requirement = await repo.findById(id);

      if (!requirement) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Requirement ${id} not found`,
          },
        });
        return;
      }

      // Map status to progress percentage
      const progressMap: Record<string, number> = {
        uploaded: 5,
        extracting: 25,
        extracted: 35,
        classifying: 50,
        classified: 60,
        decomposing: 80,
        decomposed: 100,
        failed: 0,
      };

      const progress = progressMap[requirement.status] || 0;
      const isComplete = requirement.status === 'decomposed';
      const isFailed = requirement.status === 'failed';

      res.json({
        requirementId: id,
        status: requirement.status,
        progress,
        currentPhase: requirement.status,
        startedAt: requirement.createdAt,
        updatedAt: requirement.updatedAt,
        ...(isComplete && {
          completedAt: requirement.updatedAt,
          _links: {
            decomposition: `/api/v1/requirements/${id}/decomposition`,
          },
        }),
        ...(isFailed && {
          error: {
            code: 'PROCESSING_FAILED',
            message: requirement.errorMessage || 'Decomposition failed',
          },
        }),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/requirements/:id/decomposition
 * Get decomposition results
 */
requirementsRouter.get(
  '/:id/decomposition',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id!;
      const { version: _version, include: _include } = req.query;

      const repo = await getRequirementRepository();
      const requirement = await repo.findById(id);

      if (!requirement) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Requirement ${id} not found`,
          },
        });
        return;
      }

      if (requirement.status !== 'decomposed') {
        res.status(400).json({
          error: {
            code: 'NOT_DECOMPOSED',
            message: 'Requirement has not been decomposed yet',
            currentStatus: requirement.status,
          },
          _links: {
            decompose: `/api/v1/requirements/${id}/decompose`,
            status: `/api/v1/requirements/${id}/decomposition/status`,
          },
        });
        return;
      }

      // In production, fetch decomposition from decomposition_results table
      // For now, return placeholder indicating implementation needed
      const bucket = process.env.S3_BUCKET || 'entropy-artifacts';
      const storage = getStorageService();
      const clientId = process.env.DEFAULT_CLIENT_ID || '00000000-0000-0000-0000-000000000001';
      const resultKey = `clients/${clientId}/projects/${requirement.projectId}/requirements/${id}/decomposition/result.json`;

      try {
        const result = await storage.downloadJson(resultKey, bucket);

        if (result) {
          res.json({
            decomposition: result,
            _links: {
              features: `/api/v1/features?requirementId=${id}`,
              questions: `/api/v1/questions?requirementId=${id}`,
              re_decompose: `/api/v1/requirements/${id}/decompose?force=true`,
            },
          });
          return;
        }
      } catch {
        // Result not in S3 yet
      }

      // Fallback - decomposition result not found
      res.status(404).json({
        error: {
          code: 'DECOMPOSITION_NOT_FOUND',
          message: 'Decomposition result not found',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/requirements/:id
 * Delete a requirement
 */
requirementsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id!;

    const repo = await getRequirementRepository();
    const requirement = await repo.findById(id);

    if (!requirement) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Requirement ${id} not found`,
        },
      });
      return;
    }

    // Don't allow deletion if processing is in progress
    if (['extracting', 'classifying', 'decomposing'].includes(requirement.status)) {
      res.status(409).json({
        error: {
          code: 'PROCESSING_IN_PROGRESS',
          message: 'Cannot delete requirement while processing is in progress',
        },
      });
      return;
    }

    await repo.delete(id);

    // In production, also delete S3 files
    logger.info('Requirement deleted', { requirementId: id });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
