// Environment configuration with validation

import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';

// Load .env file
dotenvConfig();

const envSchema = z.object({
  // Node environment
  NODE_ENV: z
    .enum(['development', 'staging', 'production', 'test'])
    .default('development'),

  // Server configuration
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string().optional(),
  DATABASE_POOL_SIZE: z.coerce.number().default(10),

  // Redis
  REDIS_URL: z.string().optional(),

  // AWS
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // S3 Buckets
  S3_BUCKET_UPLOADS: z.string().default('entropy-staging-uploads'),
  S3_BUCKET_ARTIFACTS: z.string().default('entropy-staging-artifacts'),
  S3_BUCKET_PROMPTS: z.string().default('entropy-staging-prompts'),

  // Model API Keys
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),

  // Default model configuration
  DEFAULT_MODEL_PROVIDER: z
    .enum(['anthropic', 'openai', 'google'])
    .default('anthropic'),
  DEFAULT_MODEL_ID: z.string().default('claude-sonnet-4-5-20250929'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Feature flags
  ENABLE_HOT_RELOAD: z.coerce.boolean().default(true),
  ENABLE_FALLBACK_CHAIN: z.coerce.boolean().default(true),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedConfig: EnvConfig | undefined;

/**
 * Get validated environment configuration
 */
export function getEnvConfig(): EnvConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${errors}`);
  }

  cachedConfig = result.data;
  return cachedConfig;
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return getEnvConfig().NODE_ENV === 'development';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return getEnvConfig().NODE_ENV === 'production';
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return getEnvConfig().NODE_ENV === 'test';
}

/**
 * Get a specific environment variable with optional default
 */
export function getEnv<K extends keyof EnvConfig>(
  key: K,
  defaultValue?: EnvConfig[K]
): EnvConfig[K] {
  const config = getEnvConfig();
  return config[key] ?? defaultValue!;
}

/**
 * Require an environment variable (throws if missing)
 */
export function requireEnv<K extends keyof EnvConfig>(key: K): NonNullable<EnvConfig[K]> {
  const value = getEnvConfig()[key];
  if (value === undefined || value === null) {
    throw new Error(`Required environment variable missing: ${key}`);
  }
  return value as NonNullable<EnvConfig[K]>;
}

/**
 * Clear cached configuration (for testing)
 */
export function clearEnvCache(): void {
  cachedConfig = undefined;
}
