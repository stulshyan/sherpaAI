import fs from 'fs';
import path from 'path';
import { test as setup } from '@playwright/test';

/**
 * Authentication Setup for E2E Tests
 *
 * This setup file runs before all tests to establish authentication state.
 * It stores the authenticated state in a file that's shared across tests.
 *
 * Since the app uses MSW for mocking in development, authentication is simulated.
 * This setup just ensures the auth directory exists and creates a basic state file.
 *
 * @see Epic E-009: End-to-End Integration
 */

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Ensure the .auth directory exists
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Navigate to home page to establish initial state
  await page.goto('/');

  // Wait for page to load
  await page.waitForLoadState('domcontentloaded');

  // Try to navigate to a protected page to trigger any auth flow
  try {
    await page.goto('/backlog', { timeout: 5000 });
    await page.waitForLoadState('domcontentloaded');
  } catch {
    // If navigation fails, that's okay - just save current state
  }

  // Check current URL - if redirected to login, try to authenticate
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    // Check for login form
    const emailInput = page.getByLabel(/email/i).or(page.locator('input[type="email"]'));
    const passwordInput = page.getByLabel(/password/i).or(page.locator('input[type="password"]'));

    // If login form exists, fill it out with demo credentials
    if ((await emailInput.count()) > 0 && (await passwordInput.count()) > 0) {
      await emailInput.fill('demo@entropy.dev');
      await passwordInput.fill('demo-password');

      // Click login button
      const loginButton = page.getByRole('button', { name: /log in|sign in|submit/i });
      if ((await loginButton.count()) > 0) {
        await loginButton.click();
        await page.waitForLoadState('networkidle');
      }
    }
  }

  // Save authentication state (this creates the auth file)
  await page.context().storageState({ path: authFile });
});
