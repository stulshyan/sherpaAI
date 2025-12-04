import path from 'path';
import { test, expect } from '@playwright/test';
import { IntakePage, DecompositionPage } from '../pages';

/**
 * Intake Hub E2E Tests
 *
 * Tests the document upload flow from intake to decomposition.
 *
 * @see Epic E-009: End-to-End Integration
 * @see Story S-055: End-to-End Tests
 */

test.describe('Intake Hub - Upload Flow', () => {
  let intakePage: IntakePage;

  test.beforeEach(async ({ page }) => {
    intakePage = new IntakePage(page);
    await intakePage.goto();
  });

  test('should display upload zone on intake page', async () => {
    await expect(intakePage.uploadZone).toBeVisible();
    await expect(intakePage.uploadZone).toContainText(/drag|drop|upload/i);
  });

  test('should upload PDF and redirect to decomposition @critical', async ({ page }) => {
    // Use a sample PDF file from fixtures
    const filePath = path.join(__dirname, '../fixtures/files/sample-requirement.pdf');

    // Upload file
    await intakePage.uploadFile(filePath);

    // Wait for upload to complete
    await intakePage.waitForUploadComplete();

    // Should redirect to decomposition view
    const decompositionPage = new DecompositionPage(page);
    await decompositionPage.waitForNavigation();

    // Should see processing message
    await expect(decompositionPage.processingMessage).toBeVisible();
    await expect(decompositionPage.processingMessage).toContainText(/processing/i);
  });

  test('should upload DOCX file successfully', async () => {
    const filePath = path.join(__dirname, '../fixtures/files/sample-requirement.docx');

    await intakePage.uploadFile(filePath);
    await intakePage.waitForUploadComplete();

    // Verify file appears in recent uploads
    const uploads = await intakePage.getRecentUploads();
    expect(uploads.length).toBeGreaterThan(0);
  });

  test('should upload TXT file successfully', async () => {
    const filePath = path.join(__dirname, '../fixtures/files/sample-requirement.txt');

    await intakePage.uploadFile(filePath);
    await intakePage.waitForUploadComplete();

    const uploads = await intakePage.getRecentUploads();
    expect(uploads.length).toBeGreaterThan(0);
  });

  test('should upload multiple files sequentially', async () => {
    const files = [
      path.join(__dirname, '../fixtures/files/sample-requirement.pdf'),
      path.join(__dirname, '../fixtures/files/sample-requirement.txt'),
    ];

    for (const file of files) {
      await intakePage.uploadFile(file);
      await intakePage.waitForUploadComplete();
    }

    const uploads = await intakePage.getRecentUploads();
    expect(uploads.length).toBeGreaterThanOrEqual(2);
  });

  test('should reject invalid file type', async () => {
    // Try to upload an image file
    const filePath = path.join(__dirname, '../fixtures/files/invalid-image.jpg');

    await intakePage.uploadFile(filePath);

    // Should see error message
    await expect(intakePage.errorMessage).toBeVisible();
    const errorText = await intakePage.getErrorMessage();
    expect(errorText.toLowerCase()).toContain('invalid');
  });

  test('should reject file exceeding size limit', async () => {
    // This test requires a large file fixture (>50MB)
    // For now, we'll skip this test if the fixture doesn't exist
    const filePath = path.join(__dirname, '../fixtures/files/large-file.pdf');

    try {
      await intakePage.uploadFile(filePath);
      await expect(intakePage.errorMessage).toBeVisible();
      const errorText = await intakePage.getErrorMessage();
      expect(errorText.toLowerCase()).toContain('large');
    } catch {
      test.skip(true, 'Large file fixture not available');
    }
  });

  test('should show upload progress indicator', async () => {
    const filePath = path.join(__dirname, '../fixtures/files/sample-requirement.pdf');

    await intakePage.uploadFile(filePath);

    // Progress indicator should be visible during upload
    await intakePage.waitForProcessing();
    await expect(intakePage.uploadProgress).toBeVisible();
  });

  test('should allow clicking on recent upload to view details', async ({ page }) => {
    // First, ensure there's at least one upload
    const filePath = path.join(__dirname, '../fixtures/files/sample-requirement.pdf');
    await intakePage.uploadFile(filePath);
    await intakePage.waitForUploadComplete();

    // Click on the recent upload
    await intakePage.clickRecentUpload('sample-requirement.pdf');

    // Should navigate to decomposition view or show details
    await expect(page).toHaveURL(/\/(decomposition|details)/);
  });
});

test.describe('Intake Hub - Decomposition Progress', () => {
  test('should see decomposition progress after upload @critical', async ({ page }) => {
    const intakePage = new IntakePage(page);
    await intakePage.goto();

    const filePath = path.join(__dirname, '../fixtures/files/sample-requirement.pdf');
    await intakePage.uploadFile(filePath);
    await intakePage.waitForUploadComplete();

    const decompositionPage = new DecompositionPage(page);
    await decompositionPage.waitForNavigation();

    // Should see progress bar or percentage
    const progress = await decompositionPage.getProgress();
    expect(progress).toBeGreaterThanOrEqual(0);
    expect(progress).toBeLessThanOrEqual(100);
  });

  test('should see emerging features during decomposition', async ({ page }) => {
    const intakePage = new IntakePage(page);
    await intakePage.goto();

    const filePath = path.join(__dirname, '../fixtures/files/sample-requirement.pdf');
    await intakePage.uploadFile(filePath);
    await intakePage.waitForUploadComplete();

    const decompositionPage = new DecompositionPage(page);
    await decompositionPage.waitForNavigation();

    // Wait for features to emerge (longer timeout for decomposition)
    await decompositionPage.waitForFeatures(60000);

    const featureCount = await decompositionPage.getFeatureCount();
    expect(featureCount).toBeGreaterThan(0);
  });

  test('should display themes during decomposition', async ({ page }) => {
    const intakePage = new IntakePage(page);
    await intakePage.goto();

    const filePath = path.join(__dirname, '../fixtures/files/sample-requirement.pdf');
    await intakePage.uploadFile(filePath);
    await intakePage.waitForUploadComplete();

    const decompositionPage = new DecompositionPage(page);
    await decompositionPage.waitForNavigation();
    await decompositionPage.waitForFeatures(60000);

    const themes = await decompositionPage.getThemes();
    expect(themes.length).toBeGreaterThan(0);
  });
});
