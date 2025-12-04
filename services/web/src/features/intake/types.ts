// Intake Hub Types

export interface UploadedRequirement {
  id: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  status: RequirementStatus;
  progress?: number; // 0-100 for processing
  uploadedAt: string; // ISO date
  completedAt?: string;
  errorMessage?: string;
  featureCount?: number; // After decomposition
  projectId: string;
}

export type RequirementStatus =
  | 'uploading'
  | 'uploaded'
  | 'processing'
  | 'completed'
  | 'failed';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
];

export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md'];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
