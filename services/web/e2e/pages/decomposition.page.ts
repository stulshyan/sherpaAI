import { Page, Locator, expect } from '@playwright/test';

/**
 * Decomposition Page Object
 *
 * Encapsulates interactions with the Decomposition View page.
 *
 * @see Epic E-009: End-to-End Integration
 */
export class DecompositionPage {
  readonly page: Page;

  // Locators
  readonly container: Locator;
  readonly processingMessage: Locator;
  readonly progressBar: Locator;
  readonly progressPercentage: Locator;
  readonly featureCards: Locator;
  readonly themesList: Locator;
  readonly errorMessage: Locator;
  readonly retryButton: Locator;
  readonly completeMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.getByTestId('decomposition-view');
    this.processingMessage = page.getByTestId('processing-message');
    this.progressBar = page.getByTestId('progress-bar');
    this.progressPercentage = page.getByTestId('progress-percentage');
    this.featureCards = page.getByTestId('emerging-feature');
    this.themesList = page.getByTestId('themes-list');
    this.errorMessage = page.getByTestId('decomposition-error');
    this.retryButton = page.getByTestId('retry-button');
    this.completeMessage = page.getByTestId('decomposition-complete');
  }

  /**
   * Navigate to a specific decomposition view
   */
  async goto(requirementId: string): Promise<void> {
    await this.page.goto(`/decomposition/${requirementId}`);
    await expect(this.container).toBeVisible();
  }

  /**
   * Wait for navigation from upload
   */
  async waitForNavigation(): Promise<void> {
    await expect(this.page).toHaveURL(/\/decomposition\//, { timeout: 15000 });
    await expect(this.container).toBeVisible();
  }

  /**
   * Wait for processing to start
   */
  async waitForProcessing(): Promise<void> {
    await expect(this.processingMessage).toBeVisible({ timeout: 10000 });
  }

  /**
   * Wait for features to emerge
   */
  async waitForFeatures(timeout: number = 60000): Promise<void> {
    await expect(this.featureCards.first()).toBeVisible({ timeout });
  }

  /**
   * Wait for decomposition to complete
   */
  async waitForComplete(timeout: number = 120000): Promise<void> {
    await expect(this.completeMessage).toBeVisible({ timeout });
  }

  /**
   * Get the current progress percentage
   */
  async getProgress(): Promise<number> {
    const text = await this.progressPercentage.textContent();
    return parseInt(text?.replace('%', '') || '0', 10);
  }

  /**
   * Get emerging feature cards
   */
  async getEmergingFeatures(): Promise<Locator[]> {
    return this.featureCards.all();
  }

  /**
   * Get the count of emerging features
   */
  async getFeatureCount(): Promise<number> {
    return this.featureCards.count();
  }

  /**
   * Get feature titles from emerging cards
   */
  async getFeatureTitles(): Promise<string[]> {
    const cards = await this.featureCards.all();
    return Promise.all(
      cards.map(async (card) => {
        const title = await card.getByTestId('feature-title').textContent();
        return title || '';
      })
    );
  }

  /**
   * Get themes list
   */
  async getThemes(): Promise<string[]> {
    const items = await this.themesList.locator('[data-testid="theme-item"]').all();
    return Promise.all(items.map((item) => item.textContent() as Promise<string>));
  }

  /**
   * Check if error is displayed
   */
  async hasError(): Promise<boolean> {
    return this.errorMessage.isVisible();
  }

  /**
   * Click retry button
   */
  async retry(): Promise<void> {
    await this.retryButton.click();
    await this.waitForProcessing();
  }

  /**
   * Click on an emerging feature to view details
   */
  async openFeature(title: string): Promise<void> {
    await this.page.locator(`[data-testid="emerging-feature"]:has-text("${title}")`).click();
  }
}
