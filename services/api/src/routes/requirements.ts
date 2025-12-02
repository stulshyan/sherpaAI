// Requirements routes

import { createLogger, MAX_FILE_SIZE_BYTES, SUPPORTED_FILE_TYPES } from '@entropy/shared';
import { Router, type IRouter } from 'express';
import multer from 'multer';

const logger = createLogger('requirements-routes');

export const requirementsRouter: IRouter = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (SUPPORTED_FILE_TYPES.includes(file.mimetype as typeof SUPPORTED_FILE_TYPES[number])) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// Upload a new requirement
requirementsRouter.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    const { projectId, title } = req.body;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    if (!projectId) {
      res.status(400).json({ error: 'projectId is required' });
      return;
    }

    logger.info('Received requirement upload', {
      projectId,
      title,
      fileName: file.originalname,
      size: file.size,
    });

    // TODO: Upload to S3, create database record
    const requirementId = crypto.randomUUID();

    res.status(201).json({
      id: requirementId,
      projectId,
      title: title || file.originalname,
      status: 'uploaded',
      fileName: file.originalname,
      fileSize: file.size,
    });
  } catch (error) {
    next(error);
  }
});

// Get requirement by ID
requirementsRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // TODO: Fetch from database
    res.json({
      id,
      status: 'pending',
      message: 'Not implemented yet',
    });
  } catch (error) {
    next(error);
  }
});

// Start decomposition
requirementsRouter.post('/:id/decompose', async (req, res, next) => {
  try {
    const { id } = req.params;

    logger.info('Starting decomposition', { requirementId: id });

    // TODO: Trigger decomposition workflow
    res.json({
      requirementId: id,
      status: 'decomposing',
      message: 'Decomposition started',
    });
  } catch (error) {
    next(error);
  }
});

// Get decomposition results
requirementsRouter.get('/:id/decomposition', async (req, res, next) => {
  try {
    const { id } = req.params;

    // TODO: Fetch decomposition results
    res.json({
      requirementId: id,
      status: 'pending',
      message: 'Not implemented yet',
    });
  } catch (error) {
    next(error);
  }
});
