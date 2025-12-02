// Global error handler middleware

import { createLogger, AdapterError } from '@entropy/shared';
import type { Request, Response, NextFunction } from 'express';

const logger = createLogger('error-handler');

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
  });

  if (error instanceof AdapterError) {
    res.status(error.statusCode || 500).json({
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    });
    return;
  }

  // Multer file size error
  if (error.message.includes('File too large')) {
    res.status(413).json({
      code: 'FILE_TOO_LARGE',
      message: 'File size exceeds the maximum allowed limit',
    });
    return;
  }

  // Multer file type error
  if (error.message.includes('Unsupported file type')) {
    res.status(415).json({
      code: 'UNSUPPORTED_FILE_TYPE',
      message: error.message,
    });
    return;
  }

  // Default error response
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
}
