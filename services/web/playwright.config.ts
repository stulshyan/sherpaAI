import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for E2E Tests (S-055)
 *
 * @see Epic E-009: End-to-End Integration
 * @see https://playwright.dev/docs/test-configuration
 */

export default defineConfig({
  testDir: './e2e/tests',

  // Test timeout (30 seconds per test)
  timeout: 30000,

  // Expect timeout for assertions
  expect: {
    timeout: 10000,
  },

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if test.only is left in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Limit workers on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ...(process.env.CI ? [['github'] as const] : []),
  ],

  // Shared settings for all projects
  use: {
    // Base URL for navigation
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',

    // Collect trace when retrying a failed test
    trace: 'on-first-retry',

    // Capture screenshot on failure
    screenshot: 'only-on-failure',

    // Record video on failure
    video: 'on-first-retry',

    // Action timeout
    actionTimeout: 10000,

    // Navigation timeout
    navigationTimeout: 15000,
  },

  // Configure projects for different browsers
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Uncomment to test on Firefox
    // {
    //   name: 'firefox',
    //   use: {
    //     ...devices['Desktop Firefox'],
    //   },
    //   dependencies: ['setup'],
    // },

    // Mobile viewport testing
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Local dev server configuration
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  // Output directory for test artifacts
  outputDir: 'e2e/test-results',
});
