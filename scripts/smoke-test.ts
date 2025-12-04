#!/usr/bin/env npx tsx
/**
 * Smoke Test Suite (S-056)
 *
 * Post-deployment verification script that tests connectivity to all external
 * services. Runs automatically after staging deploys and blocks promotion to
 * production if any checks fail.
 *
 * Usage:
 *   npx tsx scripts/smoke-test.ts             # Run all checks
 *   npx tsx scripts/smoke-test.ts --verbose   # Verbose output
 *   npx tsx scripts/smoke-test.ts --skip redis,anthropic  # Skip specific checks
 *   npx tsx scripts/smoke-test.ts --only database,api     # Run specific checks only
 *   npx tsx scripts/smoke-test.ts --format json           # JSON output
 *
 * @see Epic E-009: End-to-End Integration
 */

import { randomUUID } from 'crypto';

// ============================================================================
// Types
// ============================================================================

interface SmokeTestOptions {
  verbose: boolean;
  skip: string[];
  only: string[];
  format: 'text' | 'json';
  timeout: number;
}

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface SmokeTestReport {
  checks: CheckResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  timestamp: string;
  duration: number;
  environment: string;
}

type CheckFunction = (options: SmokeTestOptions) => Promise<CheckResult>;

// ============================================================================
// Configuration
// ============================================================================

const API_URL = process.env.API_URL || 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://entropy:entropy@localhost:5432/entropy_dev';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const S3_BUCKET = process.env.S3_BUCKET_UPLOADS || 'entropy-dev-uploads';
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:4566'; // LocalStack
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const CHECK_TIMEOUT = 10000; // 10 seconds per check

// ============================================================================
// Color Helpers (for text output)
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

// ============================================================================
// Check Implementations
// ============================================================================

async function checkApiHealth(options: SmokeTestOptions): Promise<CheckResult> {
  const start = Date.now();
  const name = 'API Health';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    const response = await fetch(`${API_URL}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    const body = await response.json();

    if (options.verbose) {
      console.log(colorize(`    Response: ${JSON.stringify(body)}`, 'gray'));
    }

    return {
      name,
      status: 'pass',
      duration: Date.now() - start,
      details: { url: `${API_URL}/api/health`, status: response.status, body },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      name,
      status: 'fail',
      duration: Date.now() - start,
      error: message.includes('ECONNREFUSED')
        ? `Cannot connect to API at ${API_URL}`
        : message,
    };
  }
}

async function checkDatabase(options: SmokeTestOptions): Promise<CheckResult> {
  const start = Date.now();
  const name = 'Database';

  try {
    // Dynamic import to handle environments without pg
    const { Pool } = await import('pg');

    const pool = new Pool({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: options.timeout,
    });

    const client = await pool.connect();
    try {
      const result = await client.query('SELECT 1 as result, NOW() as timestamp');
      const row = result.rows[0];

      if (options.verbose) {
        console.log(colorize(`    Query result: ${JSON.stringify(row)}`, 'gray'));
      }

      return {
        name,
        status: 'pass',
        duration: Date.now() - start,
        details: { connected: true, timestamp: row.timestamp },
      };
    } finally {
      client.release();
      await pool.end();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      name,
      status: 'fail',
      duration: Date.now() - start,
      error: message.includes('ECONNREFUSED')
        ? `Cannot connect to database`
        : message,
    };
  }
}

async function checkS3(options: SmokeTestOptions): Promise<CheckResult> {
  const start = Date.now();
  const name = 'S3 Storage';

  try {
    const {
      S3Client,
      PutObjectCommand,
      GetObjectCommand,
      DeleteObjectCommand,
    } = await import('@aws-sdk/client-s3');

    const s3Config: { region: string; endpoint?: string; forcePathStyle?: boolean } = {
      region: AWS_REGION,
    };

    // Use LocalStack endpoint for local development
    if (S3_ENDPOINT && S3_ENDPOINT.includes('localhost')) {
      s3Config.endpoint = S3_ENDPOINT;
      s3Config.forcePathStyle = true;
    }

    const s3 = new S3Client(s3Config);
    const testKey = `smoke-test/${Date.now()}-${randomUUID()}.txt`;
    const testContent = `Smoke test at ${new Date().toISOString()}`;

    // Write
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: testKey,
        Body: testContent,
        ContentType: 'text/plain',
      })
    );

    if (options.verbose) {
      console.log(colorize(`    Wrote test file: ${testKey}`, 'gray'));
    }

    // Read
    const getResponse = await s3.send(
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: testKey,
      })
    );
    const body = await getResponse.Body?.transformToString();

    if (body !== testContent) {
      throw new Error('Content mismatch on read');
    }

    if (options.verbose) {
      console.log(colorize(`    Read verified: content matches`, 'gray'));
    }

    // Delete
    await s3.send(
      new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: testKey,
      })
    );

    if (options.verbose) {
      console.log(colorize(`    Deleted test file`, 'gray'));
    }

    return {
      name,
      status: 'pass',
      duration: Date.now() - start,
      details: { bucket: S3_BUCKET, operations: ['put', 'get', 'delete'] },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      name,
      status: 'fail',
      duration: Date.now() - start,
      error: message.includes('ECONNREFUSED')
        ? `Cannot connect to S3 at ${S3_ENDPOINT}`
        : message.includes('AccessDenied')
          ? 'S3 Access Denied - check credentials'
          : message,
    };
  }
}

async function checkRedis(options: SmokeTestOptions): Promise<CheckResult> {
  const start = Date.now();
  const name = 'Redis Cache';

  try {
    // Dynamic import to handle environments without ioredis
    const { default: Redis } = await import('ioredis');

    const redis = new Redis(REDIS_URL, {
      connectTimeout: options.timeout,
      lazyConnect: true,
    });

    await redis.connect();

    const pingStart = Date.now();
    const pong = await redis.ping();
    const latency = Date.now() - pingStart;

    if (pong !== 'PONG') {
      throw new Error(`Expected PONG, got: ${pong}`);
    }

    if (options.verbose) {
      console.log(colorize(`    PING/PONG latency: ${latency}ms`, 'gray'));
    }

    // Test set/get
    const testKey = `smoke-test:${Date.now()}`;
    await redis.set(testKey, 'test-value', 'EX', 10);
    const value = await redis.get(testKey);
    await redis.del(testKey);

    if (value !== 'test-value') {
      throw new Error('Redis set/get verification failed');
    }

    await redis.quit();

    return {
      name,
      status: 'pass',
      duration: Date.now() - start,
      details: { latency, connected: true },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      name,
      status: 'fail',
      duration: Date.now() - start,
      error: message.includes('ECONNREFUSED')
        ? `Cannot connect to Redis at ${REDIS_URL}`
        : message.includes('timeout')
          ? 'Redis connection timeout'
          : message,
    };
  }
}

async function checkAnthropic(options: SmokeTestOptions): Promise<CheckResult> {
  const start = Date.now();
  const name = 'Anthropic API';

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      name,
      status: 'skip',
      duration: 0,
      error: 'ANTHROPIC_API_KEY not set',
    };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "ok"' }],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      // Don't expose the API key in error messages
      const message = error.error?.message || `HTTP ${response.status}`;
      throw new Error(message.replace(/sk-[a-zA-Z0-9-]+/g, 'sk-***'));
    }

    const result = await response.json();

    if (options.verbose) {
      console.log(colorize(`    Model: ${result.model}`, 'gray'));
      console.log(
        colorize(
          `    Usage: ${result.usage?.input_tokens} in / ${result.usage?.output_tokens} out`,
          'gray'
        )
      );
    }

    return {
      name,
      status: 'pass',
      duration: Date.now() - start,
      details: {
        model: result.model,
        usage: result.usage,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      name,
      status: 'fail',
      duration: Date.now() - start,
      error: message.replace(/sk-[a-zA-Z0-9-]+/g, 'sk-***'),
    };
  }
}

async function checkOpenAI(options: SmokeTestOptions): Promise<CheckResult> {
  const start = Date.now();
  const name = 'OpenAI API';

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      name,
      status: 'skip',
      duration: 0,
      error: 'OPENAI_API_KEY not set',
    };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "ok"' }],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      const message = error.error?.message || `HTTP ${response.status}`;
      throw new Error(message.replace(/sk-[a-zA-Z0-9-]+/g, 'sk-***'));
    }

    const result = await response.json();

    if (options.verbose) {
      console.log(colorize(`    Model: ${result.model}`, 'gray'));
      console.log(
        colorize(
          `    Usage: ${result.usage?.prompt_tokens} in / ${result.usage?.completion_tokens} out`,
          'gray'
        )
      );
    }

    return {
      name,
      status: 'pass',
      duration: Date.now() - start,
      details: {
        model: result.model,
        usage: result.usage,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      name,
      status: 'fail',
      duration: Date.now() - start,
      error: message.replace(/sk-[a-zA-Z0-9-]+/g, 'sk-***'),
    };
  }
}

// ============================================================================
// Check Registry
// ============================================================================

const ALL_CHECKS: Record<string, CheckFunction> = {
  api: checkApiHealth,
  database: checkDatabase,
  s3: checkS3,
  redis: checkRedis,
  anthropic: checkAnthropic,
  openai: checkOpenAI,
};

// ============================================================================
// Main Execution
// ============================================================================

async function runSmokeTests(options: SmokeTestOptions): Promise<SmokeTestReport> {
  const startTime = Date.now();
  const checks: CheckResult[] = [];

  // Determine which checks to run
  let checkNames = Object.keys(ALL_CHECKS);

  if (options.only.length > 0) {
    checkNames = checkNames.filter((name) => options.only.includes(name));
  }

  if (options.skip.length > 0) {
    checkNames = checkNames.filter((name) => !options.skip.includes(name));
  }

  if (options.format === 'text') {
    console.log(colorize('\n🔍 Running Smoke Tests...\n', 'blue'));
  }

  // Run checks sequentially to avoid resource contention
  for (const name of checkNames) {
    const checkFn = ALL_CHECKS[name];

    if (options.format === 'text') {
      process.stdout.write(`  Checking ${name.padEnd(12)}... `);
    }

    const result = await checkFn(options);
    checks.push(result);

    if (options.format === 'text') {
      const icon =
        result.status === 'pass' ? '✅' : result.status === 'skip' ? '⏭️ ' : '❌';
      const statusColor =
        result.status === 'pass' ? 'green' : result.status === 'skip' ? 'yellow' : 'red';
      const statusText = result.status.toUpperCase().padEnd(4);
      const durationText = `${result.duration}ms`;

      console.log(
        `${icon} ${colorize(statusText, statusColor)} ${colorize(durationText, 'gray')}${result.error ? ` - ${result.error}` : ''}`
      );
    }
  }

  // Calculate summary
  const summary = {
    total: checks.length,
    passed: checks.filter((c) => c.status === 'pass').length,
    failed: checks.filter((c) => c.status === 'fail').length,
    skipped: checks.filter((c) => c.status === 'skip').length,
  };

  const report: SmokeTestReport = {
    checks,
    summary,
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
    environment: process.env.NODE_ENV || 'development',
  };

  return report;
}

function printTextSummary(report: SmokeTestReport): void {
  console.log('\n' + '─'.repeat(50));

  const { passed, failed, skipped, total } = report.summary;
  const passRate = total > 0 ? Math.round((passed / (total - skipped)) * 100) : 0;

  console.log(
    `${colorize('Summary:', 'bold')} ${passed}/${total - skipped} checks passed (${passRate}%)`
  );

  if (skipped > 0) {
    console.log(colorize(`  Skipped: ${skipped}`, 'yellow'));
  }

  console.log(colorize(`  Duration: ${report.duration}ms`, 'gray'));

  if (failed > 0) {
    console.log(colorize(`\n❌ ${failed} check(s) failed`, 'red'));
  } else {
    console.log(colorize('\n✅ All checks passed!', 'green'));
  }
}

function printJsonReport(report: SmokeTestReport): void {
  console.log(JSON.stringify(report, null, 2));
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs(): SmokeTestOptions {
  const args = process.argv.slice(2);

  const options: SmokeTestOptions = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    skip: [],
    only: [],
    format: 'text',
    timeout: CHECK_TIMEOUT,
  };

  // Parse --skip flag
  const skipArg = args.find((a) => a.startsWith('--skip=') || a.startsWith('--skip '));
  if (skipArg) {
    const value = skipArg.includes('=') ? skipArg.split('=')[1] : args[args.indexOf(skipArg) + 1];
    options.skip = value.split(',').map((s) => s.trim());
  }

  // Parse --only flag
  const onlyArg = args.find((a) => a.startsWith('--only=') || a.startsWith('--only '));
  if (onlyArg) {
    const value = onlyArg.includes('=') ? onlyArg.split('=')[1] : args[args.indexOf(onlyArg) + 1];
    options.only = value.split(',').map((s) => s.trim());
  }

  // Parse --format flag
  if (args.includes('--format=json') || args.includes('--json')) {
    options.format = 'json';
  }

  // Parse --timeout flag
  const timeoutArg = args.find((a) => a.startsWith('--timeout='));
  if (timeoutArg) {
    options.timeout = parseInt(timeoutArg.split('=')[1], 10);
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs();

  try {
    const report = await runSmokeTests(options);

    if (options.format === 'json') {
      printJsonReport(report);
    } else {
      printTextSummary(report);
    }

    // Exit with error code if any checks failed
    if (report.summary.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error running smoke tests:', error);
    process.exit(1);
  }
}

main();
