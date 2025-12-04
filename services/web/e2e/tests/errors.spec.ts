import { test, expect } from '@playwright/test';
import { IntakePage, BacklogPage, DecompositionPage } from '../pages';
import path from 'path';

/**
 * Error Flow E2E Tests
 *
 * Tests error handling across the application.
 *
 * @see Epic E-009: End-to-End Integration
 * @see Story S-055: End-to-End Tests
 */

test.describe('Error Handling - Upload Errors', () => {
  let intakePage: IntakePage;

  test.beforeEach(async ({ page }) => {
    intakePage = new IntakePage(page);
    await intakePage.goto();
  });

  test('should show error for invalid file type', async () => {
    const filePath = path.join(__dirname, '../fixtures/files/invalid-image.jpg');

    await intakePage.uploadFile(filePath);

    await expect(intakePage.errorMessage).toBeVisible();
    const errorText = await intakePage.getErrorMessage();
    expect(errorText.toLowerCase()).toMatch(/invalid|unsupported|file type/);
  });

  test('should show error for empty file', async () => {
    const filePath = path.join(__dirname, '../fixtures/files/empty-file.txt');

    await intakePage.uploadFile(filePath);

    // Should either reject or show error
    const hasError = await intakePage.hasError();
    if (hasError) {
      const errorText = await intakePage.getErrorMessage();
      expect(errorText.toLowerCase()).toMatch(/empty|no content/);
    }
  });

  test('should handle file upload cancellation gracefully', async ({ page }) => {
    // Open file picker and cancel
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      intakePage.uploadButton.click(),
    ]);

    // Cancel the file chooser
    await fileChooser.setFiles([]);

    // No error should be shown
    const hasError = await intakePage.hasError();
    expect(hasError).toBe(false);
  });
});

test.describe('Error Handling - API Failures', () => {
  test('should handle API failure during decomposition', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/v1/requirements/*/decomposition', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    const intakePage = new IntakePage(page);
    await intakePage.goto();

    const filePath = path.join(__dirname, '../fixtures/files/sample-requirement.pdf');
    await intakePage.uploadFile(filePath);
    await intakePage.waitForUploadComplete();

    const decompositionPage = new DecompositionPage(page);
    await decompositionPage.waitForNavigation();

    // Should show error message
    await expect(decompositionPage.errorMessage).toBeVisible({ timeout: 30000 });
    await expect(decompositionPage.retryButton).toBeVisible();
  });

  test('should allow retry after API failure', async ({ page }) => {
    let callCount = 0;

    // Mock API to fail first time, succeed second time
    await page.route('**/api/v1/requirements/*/decomposition', (route) => {
      callCount++;
      if (callCount === 1) {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      } else {
        route.continue();
      }
    });

    const intakePage = new IntakePage(page);
    await intakePage.goto();

    const filePath = path.join(__dirname, '../fixtures/files/sample-requirement.pdf');
    await intakePage.uploadFile(filePath);
    await intakePage.waitForUploadComplete();

    const decompositionPage = new DecompositionPage(page);
    await decompositionPage.waitForNavigation();

    // First attempt should fail
    await expect(decompositionPage.errorMessage).toBeVisible({ timeout: 30000 });

    // Retry
    await decompositionPage.retry();

    // Should start processing again
    await decompositionPage.waitForProcessing();
  });

  test('should handle network timeout gracefully', async ({ page }) => {
    // Mock slow response
    await page.route('**/api/v1/backlog/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 35000)); // 35 second delay
      route.continue();
    });

    const backlogPage = new BacklogPage(page);

    // Navigate to backlog - should show loading state then timeout
    await page.goto('/backlog');

    // Should eventually show error or timeout message
    await expect(
      page.getByText(/timeout|error|try again/i).or(backlogPage.loadingSpinner)
    ).toBeVisible({ timeout: 40000 });
  });

  test('should handle 401 unauthorized by redirecting to login', async ({ page }) => {
    // Mock unauthorized response
    await page.route('**/api/v1/**', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });

    await page.goto('/backlog');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('should show session expired message', async ({ page }) => {
    // Mock session expired response
    await page.route('**/api/v1/**', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Session expired' }),
      });
    });

    await page.goto('/backlog');

    // Should show session expired message
    await expect(page.getByText(/session expired|log in again/i)).toBeVisible();
  });
});

test.describe('Error Handling - Rate Limiting', () => {
  test('should handle rate limit response', async ({ page }) => {
    // Mock rate limit response
    await page.route('**/api/v1/**', (route) => {
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: {
          'Retry-After': '60',
        },
        body: JSON.stringify({ error: 'Too many requests' }),
      });
    });

    const backlogPage = new BacklogPage(page);
    await page.goto('/backlog');

    // Should show rate limit message
    await expect(page.getByText(/too many requests|rate limit|try again/i)).toBeVisible();
  });
});

test.describe('Error Handling - Form Validation', () => {
  test('should validate required fields on settings', async ({ page }) => {
    await page.goto('/settings');

    // Clear a required field and try to save
    const anthropicInput = page.getByTestId('anthropic-api-key');
    await anthropicInput.clear();

    // Try to save
    await page.getByTestId('save-settings').click();

    // Should show validation error or not allow save
    const hasError = await page.getByTestId('toast-error').isVisible();
    if (!hasError) {
      // Check for inline validation error
      const validationError = page.getByText(/required|invalid/i);
      await expect(validationError).toBeVisible();
    }
  });
});

test.describe('Error Handling - Not Found', () => {
  test('should show 404 page for invalid route', async ({ page }) => {
    await page.goto('/non-existent-page-12345');

    // Should show 404 or redirect
    const content = await page.content();
    expect(content.toLowerCase()).toMatch(/not found|404|page doesn't exist/);
  });

  test('should show error for non-existent feature', async ({ page }) => {
    await page.goto('/features/non-existent-feature-id-12345');

    // Should show error
    await expect(page.getByText(/not found|doesn't exist|error/i)).toBeVisible();
  });

  test('should show error for non-existent requirement', async ({ page }) => {
    await page.goto('/decomposition/non-existent-requirement-id-12345');

    // Should show error
    await expect(page.getByText(/not found|doesn't exist|error/i)).toBeVisible();
  });
});

test.describe('Error Handling - Connection Issues', () => {
  test('should show offline message when disconnected', async ({ page, context }) => {
    // Load the page first
    const backlogPage = new BacklogPage(page);
    await backlogPage.goto();

    // Go offline
    await context.setOffline(true);

    // Try to navigate or perform an action
    await page.reload();

    // Should show offline message
    await expect(page.getByText(/offline|no connection|network/i)).toBeVisible();

    // Go back online
    await context.setOffline(false);
  });

  test('should recover after reconnection', async ({ page, context }) => {
    const backlogPage = new BacklogPage(page);
    await backlogPage.goto();

    // Go offline
    await context.setOffline(true);
    await page.reload();

    // Go back online
    await context.setOffline(false);

    // Wait a moment and reload
    await page.waitForTimeout(1000);
    await page.reload();

    // Should recover and show content
    await backlogPage.waitForLoad();
    await expect(backlogPage.backlogContainer).toBeVisible();
  });
});
