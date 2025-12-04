#!/usr/bin/env npx tsx
/**
 * Demo Recording Script (S-057)
 *
 * Automatically walks through the demo flow and records a 1080p, 60fps MP4 video.
 * Uses Playwright's video recording feature.
 *
 * Usage:
 *   npx tsx scripts/record-demo.ts             # Record demo video
 *   npx tsx scripts/record-demo.ts --speed 0.5 # Slow motion recording
 *   npx tsx scripts/record-demo.ts --resolution 720p  # Lower resolution
 *   npx tsx scripts/record-demo.ts --output /tmp/demo.mp4  # Custom output path
 *   npx tsx scripts/record-demo.ts --narration # Generate narration script
 *
 * @see Epic E-009: End-to-End Integration
 */

import { writeFileSync, mkdirSync, existsSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { chromium, Page, Browser, BrowserContext } from 'playwright';

// ============================================================================
// Types
// ============================================================================

interface RecordOptions {
  speed: number; // 1.0 = normal, 0.5 = slow
  resolution: '1080p' | '720p';
  output: string;
  narration: boolean;
  skip: string[];
  baseUrl: string;
}

interface DemoStep {
  name: string;
  action: (page: Page, options: RecordOptions) => Promise<void>;
  duration: number; // Base duration in ms
  narrationText: string;
}

interface NarrationPoint {
  timestamp: string;
  text: string;
}

// ============================================================================
// Configuration
// ============================================================================

const RESOLUTIONS = {
  '1080p': { width: 1920, height: 1080 },
  '720p': { width: 1280, height: 720 },
};

const DEFAULT_OPTIONS: RecordOptions = {
  speed: 1.0,
  resolution: '1080p',
  output: '',
  narration: true,
  skip: [],
  baseUrl: process.env.DEMO_BASE_URL || 'http://localhost:5173',
};

// Demo user credentials
const DEMO_USER = {
  email: 'demo@entropy.ai',
  password: 'demo-password',
};

// ============================================================================
// Demo Steps
// ============================================================================

const DEMO_STEPS: DemoStep[] = [
  {
    name: 'login',
    action: loginStep,
    duration: 3000,
    narrationText: 'Welcome to Entropy AI Platform. Let\'s start by logging in.',
  },
  {
    name: 'intake',
    action: intakeStep,
    duration: 5000,
    narrationText:
      'This is the Intake Hub where you can upload your requirement documents.',
  },
  {
    name: 'upload',
    action: uploadStep,
    duration: 8000,
    narrationText:
      'Simply drag and drop your requirements PDF, DOCX, or TXT files here.',
  },
  {
    name: 'decomposition',
    action: decompositionStep,
    duration: 15000,
    narrationText:
      'Watch as Entropy\'s AI analyzes and decomposes your requirements into actionable features.',
  },
  {
    name: 'backlog',
    action: backlogStep,
    duration: 10000,
    narrationText:
      'Your features are automatically prioritized in the Backlog view.',
  },
  {
    name: 'feature-detail',
    action: featureDetailStep,
    duration: 10000,
    narrationText:
      'Click on any feature to see detailed information, requirements, and readiness scores.',
  },
  {
    name: 'answer-question',
    action: answerQuestionStep,
    duration: 8000,
    narrationText:
      'Answer clarification questions to improve feature readiness and unblock development.',
  },
  {
    name: 'settings',
    action: settingsStep,
    duration: 5000,
    narrationText:
      'Configure your AI models and API keys in the Settings page.',
  },
];

// ============================================================================
// Step Implementations
// ============================================================================

async function loginStep(page: Page, options: RecordOptions): Promise<void> {
  await page.goto(`${options.baseUrl}/login`);
  await page.waitForLoadState('networkidle');
  await pause(500 / options.speed);

  // Type email with realistic speed
  await typeWithDelay(page, '[data-testid="email-input"]', DEMO_USER.email, options.speed);
  await pause(300 / options.speed);

  // Type password
  await typeWithDelay(page, '[data-testid="password-input"]', DEMO_USER.password, options.speed);
  await pause(300 / options.speed);

  // Click login
  await smoothClick(page, '[data-testid="login-button"]');
  await page.waitForURL(/\/(dashboard|backlog)/);
  await pause(1000 / options.speed);
}

async function intakeStep(page: Page, options: RecordOptions): Promise<void> {
  // Navigate to intake
  await smoothClick(page, '[data-testid="nav-intake"]');
  await page.waitForSelector('[data-testid="upload-zone"]');
  await pause(1000 / options.speed);

  // Hover over upload zone
  await page.hover('[data-testid="upload-zone"]');
  await pause(500 / options.speed);
}

async function uploadStep(page: Page, options: RecordOptions): Promise<void> {
  // Simulate file upload with visual feedback
  const fileInput = page.locator('input[type="file"]');

  // Use the sample requirement file
  const sampleFile = join(__dirname, '../services/web/e2e/fixtures/files/sample-requirement.txt');

  if (existsSync(sampleFile)) {
    await fileInput.setInputFiles(sampleFile);
  } else {
    // Create a temporary sample file if fixture doesn't exist
    const tempFile = '/tmp/sample-requirement.txt';
    writeFileSync(
      tempFile,
      `E-Commerce Platform Requirements
=====================================

1. User Authentication
   - OAuth2 login with Google and Microsoft
   - Multi-factor authentication support
   - JWT token management

2. Product Catalog
   - Search and filter products
   - Product detail pages
   - Category navigation

3. Shopping Cart
   - Add/remove items
   - Quantity updates
   - Guest checkout

4. Payment Processing
   - Stripe integration
   - Apple Pay / Google Pay
   - Subscription billing`
    );
    await fileInput.setInputFiles(tempFile);
  }

  await pause(1000 / options.speed);

  // Wait for upload status
  try {
    await page.waitForSelector('[data-testid="upload-status"]', { timeout: 5000 });
    await pause(2000 / options.speed);
  } catch {
    // Continue if no status element
  }
}

async function decompositionStep(page: Page, options: RecordOptions): Promise<void> {
  // Wait for navigation to decomposition or for processing to start
  try {
    await page.waitForURL(/\/decomposition/, { timeout: 10000 });
  } catch {
    // Try clicking on recent upload
    try {
      await smoothClick(page, '[data-testid="upload-item"]');
    } catch {
      // Navigate directly to backlog if decomposition isn't available
      await page.goto(`${options.baseUrl}/backlog`);
      return;
    }
  }

  await pause(2000 / options.speed);

  // Show processing progress (if available)
  try {
    await page.waitForSelector('[data-testid="progress-bar"]', { timeout: 5000 });

    // Wait for some progress
    for (let i = 0; i < 3; i++) {
      await pause(2000 / options.speed);
      const progress = await page.locator('[data-testid="progress-percentage"]').textContent();
      if (progress && parseInt(progress) >= 50) break;
    }
  } catch {
    // Continue if no progress bar
  }

  // Wait for features to emerge
  try {
    await page.waitForSelector('[data-testid="emerging-feature"]', { timeout: 10000 });
    await pause(2000 / options.speed);
  } catch {
    // Continue if no emerging features
  }
}

async function backlogStep(page: Page, options: RecordOptions): Promise<void> {
  // Navigate to backlog
  await smoothClick(page, '[data-testid="nav-backlog"]');
  await page.waitForSelector('[data-testid="backlog-container"]');
  await pause(1500 / options.speed);

  // Scroll through features
  await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
  await pause(1000 / options.speed);

  // Click on different tabs
  try {
    await smoothClick(page, '[data-testid="tab-ready-soon"]');
    await pause(1000 / options.speed);

    await smoothClick(page, '[data-testid="tab-needs-attention"]');
    await pause(1000 / options.speed);

    await smoothClick(page, '[data-testid="tab-now-playing"]');
    await pause(1000 / options.speed);
  } catch {
    // Continue if tabs not available
  }
}

async function featureDetailStep(page: Page, options: RecordOptions): Promise<void> {
  // Click on first feature card
  try {
    await smoothClick(page, '[data-testid="feature-card"]');
    await page.waitForSelector('[data-testid="feature-modal"]');
    await pause(1500 / options.speed);

    // Click through tabs
    await smoothClick(page, '[data-testid="tab-requirements"]');
    await pause(1000 / options.speed);

    await smoothClick(page, '[data-testid="tab-questions"]');
    await pause(1000 / options.speed);

    await smoothClick(page, '[data-testid="tab-history"]');
    await pause(1000 / options.speed);

    await smoothClick(page, '[data-testid="tab-overview"]');
    await pause(1000 / options.speed);
  } catch {
    // Continue if modal not available
  }
}

async function answerQuestionStep(page: Page, options: RecordOptions): Promise<void> {
  // Go to questions tab
  try {
    await smoothClick(page, '[data-testid="tab-questions"]');
    await pause(1000 / options.speed);

    // Answer a yes/no question
    const yesButton = page.locator('[data-testid="answer-yes"]').first();
    if (await yesButton.isVisible()) {
      await smoothClick(page, '[data-testid="answer-yes"]');
      await pause(1500 / options.speed);
    }

    // Close modal
    await smoothClick(page, '[data-testid="modal-close"]');
    await pause(500 / options.speed);
  } catch {
    // Close modal if open
    try {
      await smoothClick(page, '[data-testid="modal-close"]');
    } catch {
      // No modal to close
    }
  }
}

async function settingsStep(page: Page, options: RecordOptions): Promise<void> {
  // Navigate to settings
  await smoothClick(page, '[data-testid="nav-settings"]');

  try {
    await page.waitForSelector('[data-testid="settings-page"]');
    await pause(1500 / options.speed);

    // Hover over model selector
    await page.hover('[data-testid="model-selector"]');
    await pause(1000 / options.speed);

    // Scroll to API keys section
    await page.evaluate(() => window.scrollBy({ top: 200, behavior: 'smooth' }));
    await pause(1500 / options.speed);
  } catch {
    // Continue if settings elements not available
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function pause(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function typeWithDelay(
  page: Page,
  selector: string,
  text: string,
  speed: number
): Promise<void> {
  const element = page.locator(selector);
  await element.click();

  for (const char of text) {
    await element.type(char, { delay: 50 / speed });
  }
}

async function smoothClick(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector).first();
  await element.scrollIntoViewIfNeeded();
  await pause(100);
  await element.hover();
  await pause(100);
  await element.click();
}

function formatTimestamp(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function generateNarrationScript(steps: DemoStep[], options: RecordOptions): string {
  const narrationPoints: NarrationPoint[] = [];
  let currentTime = 0;

  for (const step of steps) {
    if (options.skip.includes(step.name)) continue;

    narrationPoints.push({
      timestamp: formatTimestamp(currentTime),
      text: step.narrationText,
    });

    currentTime += step.duration / options.speed;
  }

  let script = '# Entropy Platform Demo Narration Script\n\n';
  script += `Generated: ${new Date().toISOString()}\n`;
  script += `Duration: ~${formatTimestamp(currentTime)}\n\n`;
  script += '---\n\n';

  for (const point of narrationPoints) {
    script += `**[${point.timestamp}]** ${point.text}\n\n`;
  }

  script += '---\n\n';
  script += '## Key Talking Points\n\n';
  script += '1. **AI-Powered Decomposition** - Automatically breaks down complex requirements\n';
  script += '2. **Prioritized Backlog** - Features ranked by business value and readiness\n';
  script += '3. **Clarification Workflow** - Answer questions to improve feature quality\n';
  script += '4. **Multi-Model Support** - Use Claude, GPT-4, or Gemini as needed\n';

  return script;
}

// ============================================================================
// Main Recording Function
// ============================================================================

async function recordDemo(options: RecordOptions): Promise<void> {
  const resolution = RESOLUTIONS[options.resolution];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = 'demos';
  const videoDir = join(outputDir, 'temp-video');

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  console.log('🎬 Starting demo recording...\n');
  console.log(`  Resolution: ${options.resolution} (${resolution.width}x${resolution.height})`);
  console.log(`  Speed: ${options.speed}x`);
  console.log(`  Base URL: ${options.baseUrl}`);
  console.log('');

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    // Launch browser with video recording
    browser = await chromium.launch({
      headless: true,
    });

    context = await browser.newContext({
      viewport: resolution,
      recordVideo: {
        dir: videoDir,
        size: resolution,
      },
    });

    const page = await context.newPage();

    // Run demo steps
    for (const step of DEMO_STEPS) {
      if (options.skip.includes(step.name)) {
        console.log(`  ⏭️  Skipping: ${step.name}`);
        continue;
      }

      console.log(`  📹 Recording: ${step.name}`);

      try {
        await step.action(page, options);
        await pause(step.duration / options.speed);
      } catch (error) {
        console.log(`  ⚠️  Warning: ${step.name} encountered an issue, continuing...`);
      }
    }

    // Close page to finalize video
    await page.close();
    await context.close();
    context = null;

    // Find and move the video file
    const { readdirSync } = await import('fs');
    const videoFiles = readdirSync(videoDir);

    if (videoFiles.length > 0) {
      const videoFile = videoFiles[0];
      const sourcePath = join(videoDir, videoFile);
      const outputPath = options.output || join(outputDir, `demo-${timestamp}.webm`);

      // Ensure output directory exists
      const outputDirPath = dirname(outputPath);
      if (!existsSync(outputDirPath)) {
        mkdirSync(outputDirPath, { recursive: true });
      }

      renameSync(sourcePath, outputPath);

      console.log(`\n✅ Demo recorded: ${outputPath}`);

      // Generate narration script if requested
      if (options.narration) {
        const narrationPath = outputPath.replace(/\.(mp4|webm)$/, '-narration.md');
        const narrationScript = generateNarrationScript(DEMO_STEPS, options);
        writeFileSync(narrationPath, narrationScript);
        console.log(`📝 Narration script: ${narrationPath}`);
      }
    } else {
      console.log('\n⚠️  No video file was created');
    }

    // Cleanup temp directory
    const { rmSync } = await import('fs');
    rmSync(videoDir, { recursive: true, force: true });
  } catch (error) {
    console.error('\n❌ Error recording demo:', error);
    throw error;
  } finally {
    if (context) {
      await context.close();
    }
    if (browser) {
      await browser.close();
    }
  }
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs(): RecordOptions {
  const args = process.argv.slice(2);
  const options = { ...DEFAULT_OPTIONS };

  // Parse --speed
  const speedArg = args.find((a) => a.startsWith('--speed='));
  if (speedArg) {
    options.speed = parseFloat(speedArg.split('=')[1]);
  }

  // Parse --resolution
  const resArg = args.find((a) => a.startsWith('--resolution='));
  if (resArg) {
    const res = resArg.split('=')[1];
    if (res === '720p' || res === '1080p') {
      options.resolution = res;
    }
  }

  // Parse --output
  const outputArg = args.find((a) => a.startsWith('--output='));
  if (outputArg) {
    options.output = outputArg.split('=')[1];
  }

  // Parse --narration
  options.narration = !args.includes('--no-narration');

  // Parse --skip
  const skipArg = args.find((a) => a.startsWith('--skip='));
  if (skipArg) {
    options.skip = skipArg.split('=')[1].split(',');
  }

  // Parse --baseUrl
  const urlArg = args.find((a) => a.startsWith('--url='));
  if (urlArg) {
    options.baseUrl = urlArg.split('=')[1];
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs();

  // Check if app is running
  try {
    const response = await fetch(`${options.baseUrl}/`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch {
    console.error(`\n❌ Cannot connect to application at ${options.baseUrl}`);
    console.error('   Make sure the dev server is running: pnpm dev');
    process.exit(1);
  }

  await recordDemo(options);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
