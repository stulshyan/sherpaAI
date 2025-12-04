import { test as setup, expect } from '@playwright/test';

/**
 * Authentication Setup for E2E Tests
 *
 * This setup file runs before all tests to establish authentication state.
 * It stores the authenticated state in a file that's shared across tests.
 *
 * @see Epic E-009: End-to-End Integration
 */

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');

  // Wait for the page to load
  await page.waitForLoadState('networkidle');

  // Check if we're already logged in (redirected to dashboard)
  const currentUrl = page.url();
  if (currentUrl.includes('/dashboard') || currentUrl.includes('/backlog')) {
    // Already authenticated, save state and return
    await page.context().storageState({ path: authFile });
    return;
  }

  // Check for login form
  const emailInput = page.getByLabel(/email/i).or(page.locator('input[type="email"]'));
  const passwordInput = page
    .getByLabel(/password/i)
    .or(page.locator('input[type="password"]'));

  // If login form exists, fill it out with demo credentials
  if ((await emailInput.count()) > 0 && (await passwordInput.count()) > 0) {
    await emailInput.fill('demo@entropy.dev');
    await passwordInput.fill('demo-password');

    // Click login button
    const loginButton = page.getByRole('button', { name: /log in|sign in|submit/i });
    await loginButton.click();

    // Wait for navigation to complete
    await expect(page).toHaveURL(/dashboard|backlog|intake/, { timeout: 10000 });
  }

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
