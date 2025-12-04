import { test as base, expect } from '@playwright/test';

/**
 * Authentication Fixture for E2E Tests
 *
 * Provides authenticated user context for tests.
 *
 * @see Epic E-009: End-to-End Integration
 */

// Demo credentials
const DEMO_USER = {
  email: 'demo@entropy.ai',
  password: 'demo-password',
};

// Storage state file path
export const STORAGE_STATE = 'e2e/.auth/user.json';

/**
 * Extended test with authentication support
 */
export const test = base.extend<{
  authenticatedPage: typeof base;
}>({
  authenticatedPage: async ({ page }, use) => {
    // Check if already authenticated
    await page.goto('/');

    // If redirected to login, perform login
    if (page.url().includes('/login')) {
      await page.fill('[data-testid="email-input"]', DEMO_USER.email);
      await page.fill('[data-testid="password-input"]', DEMO_USER.password);
      await page.click('[data-testid="login-button"]');

      // Wait for navigation away from login
      await expect(page).not.toHaveURL(/\/login/);
    }

    await use(base);
  },
});

/**
 * Login helper function
 */
export async function login(
  page: typeof base extends { prototype: infer P } ? P : never,
  email: string = DEMO_USER.email,
  password: string = DEMO_USER.password
): Promise<void> {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  await expect(page).not.toHaveURL(/\/login/);
}

/**
 * Logout helper function
 */
export async function logout(
  page: typeof base extends { prototype: infer P } ? P : never
): Promise<void> {
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');
  await expect(page).toHaveURL(/\/login/);
}

export { expect };
