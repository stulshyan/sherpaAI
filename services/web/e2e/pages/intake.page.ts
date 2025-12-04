import { Page, Locator, expect } from '@playwright/test';

/**
 * Intake Hub Page Object
 *
 * Encapsulates interactions with the Intake Hub page for document uploads.
 *
 * @see Epic E-009: End-to-End Integration
 */
export class IntakePage {
  readonly page: Page;

  // Locators
  readonly uploadZone: Locator;
  readonly fileInput: Locator;
  readonly uploadStatus: Locator;
  readonly uploadProgress: Locator;
  readonly errorMessage: Locator;
  readonly recentUploads: Locator;
  readonly uploadButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.uploadZone = page.getByTestId('upload-zone');
    this.fileInput = page.locator('input[type="file"]');
    this.uploadStatus = page.getByTestId('upload-status');
    this.uploadProgress = page.getByTestId('upload-progress');
    this.errorMessage = page.getByTestId('error-message');
    this.recentUploads = page.getByTestId('recent-uploads');
    this.uploadButton = page.getByTestId('upload-button');
  }

  /**
   * Navigate to the Intake Hub page
   */
  async goto(): Promise<void> {
    await this.page.goto('/intake');
    await expect(this.uploadZone).toBeVisible();
  }

  /**
   * Upload a file using the file input
   */
  async uploadFile(filePath: string): Promise<void> {
    await this.fileInput.setInputFiles(filePath);
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(filePaths: string[]): Promise<void> {
    await this.fileInput.setInputFiles(filePaths);
  }

  /**
   * Wait for upload to complete
   */
  async waitForUploadComplete(timeout: number = 10000): Promise<void> {
    await expect(this.uploadStatus).toHaveText(/complete|uploaded/i, { timeout });
  }

  /**
   * Wait for upload to start processing
   */
  async waitForProcessing(): Promise<void> {
    await expect(this.uploadStatus).toHaveText(/processing|uploading/i);
  }

  /**
   * Get recent upload items
   */
  async getRecentUploads(): Promise<string[]> {
    const items = await this.recentUploads.locator('[data-testid="upload-item"]').all();
    return Promise.all(items.map((item) => item.textContent() as Promise<string>));
  }

  /**
   * Check if error message is displayed
   */
  async hasError(): Promise<boolean> {
    return this.errorMessage.isVisible();
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    return (await this.errorMessage.textContent()) || '';
  }

  /**
   * Drag and drop a file (simulated)
   */
  async dragAndDrop(filePath: string): Promise<void> {
    // Create a file with the given path
    const dataTransfer = await this.page.evaluateHandle(() => new DataTransfer());

    // Dispatch drop event
    await this.uploadZone.dispatchEvent('drop', { dataTransfer });

    // Fall back to file input for actual file upload
    await this.fileInput.setInputFiles(filePath);
  }

  /**
   * Click on a specific upload in the recent uploads list
   */
  async clickRecentUpload(filename: string): Promise<void> {
    await this.recentUploads.locator(`text=${filename}`).click();
  }
}
