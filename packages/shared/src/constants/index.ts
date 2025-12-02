// Application constants

export const APP_NAME = 'Entropy Platform';
export const APP_VERSION = '0.1.0';

// Readiness thresholds
export const READINESS_THRESHOLD_LOOP_A = 0.7;
export const READINESS_THRESHOLD_READY_SOON = 0.6;
export const READINESS_THRESHOLD_NEEDS_ATTENTION = 0.4;

// Default limits
export const DEFAULT_WIP_LIMIT = 3;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// Supported file types
export const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
] as const;

export const FILE_EXTENSIONS = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    '.docx',
  'text/plain': '.txt',
  'text/markdown': '.md',
} as const;

// S3 paths
export const S3_PATHS = {
  UPLOADS: 'uploads',
  ARTIFACTS: 'artifacts',
  PROMPTS: 'prompts',
  ORIGINAL: 'original',
  PROCESSED: 'processed',
  DECOMPOSITION: '01_decomposition',
  IMPACT_ANALYSIS: '02_impact_analysis',
  LIVING_SPEC: '03_living_spec',
  CODE_DRAFT: '04_code_draft',
} as const;

// API paths
export const API_VERSION = 'v1';
export const API_PATHS = {
  HEALTH: '/health',
  REQUIREMENTS: `/${API_VERSION}/requirements`,
  FEATURES: `/${API_VERSION}/features`,
  BACKLOG: `/${API_VERSION}/backlog`,
  QUESTIONS: `/${API_VERSION}/questions`,
  CONFIG: `/${API_VERSION}/config`,
} as const;

// Cache TTLs (in seconds)
export const CACHE_TTL = {
  CONFIG: 300, // 5 minutes
  PROMPT_TEMPLATE: 3600, // 1 hour
  MODEL_HEALTH: 60, // 1 minute
  FEATURE_LIST: 30, // 30 seconds
} as const;

// Model defaults
export const MODEL_DEFAULTS = {
  MAX_TOKENS: 4096,
  TEMPERATURE: 0.7,
  TIMEOUT_MS: 60000, // 1 minute
  MAX_RETRIES: 3,
} as const;
