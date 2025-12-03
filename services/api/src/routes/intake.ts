// Intake routes for file uploads and requirement processing

import { createLogger } from '@entropy/shared';
import { Router, type IRouter, type Request } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';

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

// In-memory storage for uploads (replace with database + S3 in production)
interface Upload {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  uploadedAt: Date;
  processedAt?: Date;
  requirementId?: string;
  featureCount?: number;
  error?: string;
}

const uploads: Map<string, Upload> = new Map();

// Mock processing function
async function processDocument(upload: Upload): Promise<void> {
  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Update status
  upload.status = 'complete';
  upload.processedAt = new Date();
  upload.requirementId = `req-${randomUUID().slice(0, 8)}`;
  upload.featureCount = Math.floor(Math.random() * 5) + 1; // 1-5 features

  logger.info('Document processed', {
    uploadId: upload.id,
    requirementId: upload.requirementId,
    featureCount: upload.featureCount,
  });
}

/**
 * POST /api/v1/intake/upload
 * Upload a requirement document
 */
intakeRouter.post('/upload', upload.single('file'), async (req: Request, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const uploadId = randomUUID();
    const uploadRecord: Upload = {
      id: uploadId,
      filename: `${uploadId}-${req.file.originalname}`,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      status: 'uploading',
      uploadedAt: new Date(),
    };

    uploads.set(uploadId, uploadRecord);

    logger.info('File upload started', {
      uploadId,
      filename: req.file.originalname,
      size: req.file.size,
    });

    // In production, upload to S3 here
    // const storageService = createStorageService();
    // await storageService.upload(`uploads/${uploadRecord.filename}`, req.file.buffer);

    // Update status to processing
    uploadRecord.status = 'processing';

    // Start async processing
    processDocument(uploadRecord).catch((error) => {
      uploadRecord.status = 'error';
      uploadRecord.error = error instanceof Error ? error.message : 'Processing failed';
    });

    res.json({
      id: uploadId,
      filename: uploadRecord.originalName,
      size: uploadRecord.size,
      status: uploadRecord.status,
      message: 'File uploaded successfully. Processing started.',
    });
  } catch (error) {
    logger.error('Upload failed', { error });
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Upload failed',
    });
  }
});

/**
 * GET /api/v1/intake/uploads
 * List all uploads
 */
intakeRouter.get('/uploads', (_req, res) => {
  const allUploads = Array.from(uploads.values())
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .map((u) => ({
      id: u.id,
      filename: u.originalName,
      size: u.size,
      status: u.status,
      uploadedAt: u.uploadedAt,
      processedAt: u.processedAt,
      requirementId: u.requirementId,
      featureCount: u.featureCount,
      error: u.error,
    }));

  res.json({ uploads: allUploads });
});

/**
 * GET /api/v1/intake/uploads/:id
 * Get upload status
 */
intakeRouter.get('/uploads/:id', (req, res) => {
  const { id } = req.params;
  const uploadRecord = uploads.get(id);

  if (!uploadRecord) {
    res.status(404).json({ error: 'Upload not found' });
    return;
  }

  res.json({
    id: uploadRecord.id,
    filename: uploadRecord.originalName,
    size: uploadRecord.size,
    status: uploadRecord.status,
    uploadedAt: uploadRecord.uploadedAt,
    processedAt: uploadRecord.processedAt,
    requirementId: uploadRecord.requirementId,
    featureCount: uploadRecord.featureCount,
    error: uploadRecord.error,
  });
});

/**
 * DELETE /api/v1/intake/uploads/:id
 * Delete an upload
 */
intakeRouter.delete('/uploads/:id', (req, res) => {
  const { id } = req.params;

  if (!uploads.has(id)) {
    res.status(404).json({ error: 'Upload not found' });
    return;
  }

  uploads.delete(id);

  res.json({ success: true, message: 'Upload deleted' });
});

/**
 * POST /api/v1/intake/uploads/:id/reprocess
 * Reprocess a failed upload
 */
intakeRouter.post('/uploads/:id/reprocess', async (req, res) => {
  const { id } = req.params;
  const uploadRecord = uploads.get(id);

  if (!uploadRecord) {
    res.status(404).json({ error: 'Upload not found' });
    return;
  }

  if (uploadRecord.status !== 'error') {
    res.status(400).json({ error: 'Only failed uploads can be reprocessed' });
    return;
  }

  uploadRecord.status = 'processing';
  uploadRecord.error = undefined;

  // Start async processing
  processDocument(uploadRecord).catch((error) => {
    uploadRecord.status = 'error';
    uploadRecord.error = error instanceof Error ? error.message : 'Processing failed';
  });

  res.json({
    id: uploadRecord.id,
    status: uploadRecord.status,
    message: 'Reprocessing started',
  });
});
