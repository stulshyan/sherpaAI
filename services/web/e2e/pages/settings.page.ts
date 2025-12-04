import { Page, Locator, expect } from '@playwright/test';

/**
 * Settings Page Object
 *
 * Encapsulates interactions with the Settings page.
 *
 * @see Epic E-009: End-to-End Integration
 */
export class SettingsPage {
  readonly page: Page;

  // Locators
  readonly container: Locator;
  readonly modelSelector: Locator;
  readonly apiKeyInputs: Locator;
  readonly saveButton: Locator;
  readonly testConnectionButton: Locator;
  readonly successToast: Locator;
  readonly errorToast: Locator;

  // Model configuration
  readonly currentModel: Locator;
  readonly fallbackChain: Locator;

  // API Keys section
  readonly anthropicKeyInput: Locator;
  readonly openaiKeyInput: Locator;
  readonly googleKeyInput: Locator;
  readonly apiKeyStatus: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.getByTestId('settings-page');
    this.modelSelector = page.getByTestId('model-selector');
    this.apiKeyInputs = page.getByTestId('api-key-input');
    this.saveButton = page.getByTestId('save-settings');
    this.testConnectionButton = page.getByTestId('test-connection');
    this.successToast = page.getByTestId('toast-success');
    this.errorToast = page.getByTestId('toast-error');

    // Model configuration
    this.currentModel = page.getByTestId('current-model');
    this.fallbackChain = page.getByTestId('fallback-chain');

    // API Keys
    this.anthropicKeyInput = page.getByTestId('anthropic-api-key');
    this.openaiKeyInput = page.getByTestId('openai-api-key');
    this.googleKeyInput = page.getByTestId('google-api-key');
    this.apiKeyStatus = page.getByTestId('api-key-status');
  }

  /**
   * Navigate to the Settings page
   */
  async goto(): Promise<void> {
    await this.page.goto('/settings');
    await expect(this.container).toBeVisible();
  }

  /**
   * Get the current model selection
   */
  async getCurrentModel(): Promise<string> {
    return (await this.currentModel.textContent()) || '';
  }

  /**
   * Select a model from the dropdown
   */
  async selectModel(modelId: string): Promise<void> {
    await this.modelSelector.click();
    await this.page.locator(`[data-testid="model-option-${modelId}"]`).click();
  }

  /**
   * Save settings
   */
  async save(): Promise<void> {
    await this.saveButton.click();
    await expect(this.successToast).toBeVisible({ timeout: 5000 });
  }

  /**
   * Test API connection
   */
  async testConnection(provider: 'anthropic' | 'openai' | 'google'): Promise<boolean> {
    await this.page.getByTestId(`test-${provider}-connection`).click();

    // Wait for result
    const success = this.page.getByTestId(`${provider}-connection-success`);
    const failure = this.page.getByTestId(`${provider}-connection-failure`);

    await expect(success.or(failure)).toBeVisible({ timeout: 10000 });

    return success.isVisible();
  }

  /**
   * Set API key for a provider
   */
  async setApiKey(provider: 'anthropic' | 'openai' | 'google', key: string): Promise<void> {
    const inputMap = {
      anthropic: this.anthropicKeyInput,
      openai: this.openaiKeyInput,
      google: this.googleKeyInput,
    };

    await inputMap[provider].fill(key);
  }

  /**
   * Get API key status for a provider
   */
  async getApiKeyStatus(
    provider: 'anthropic' | 'openai' | 'google'
  ): Promise<'valid' | 'invalid' | 'not-set'> {
    const status = this.page.getByTestId(`${provider}-key-status`);
    const text = await status.textContent();

    if (text?.includes('valid')) return 'valid';
    if (text?.includes('invalid')) return 'invalid';
    return 'not-set';
  }

  /**
   * Get fallback chain
   */
  async getFallbackChain(): Promise<string[]> {
    const items = await this.fallbackChain.locator('[data-testid="fallback-item"]').all();
    return Promise.all(items.map((item) => item.textContent() as Promise<string>));
  }

  /**
   * Add model to fallback chain
   */
  async addToFallbackChain(modelId: string): Promise<void> {
    await this.page.getByTestId('add-fallback').click();
    await this.page.locator(`[data-testid="fallback-option-${modelId}"]`).click();
  }

  /**
   * Remove model from fallback chain
   */
  async removeFromFallbackChain(modelId: string): Promise<void> {
    await this.page.locator(`[data-testid="remove-fallback-${modelId}"]`).click();
  }

  /**
   * Check if success toast is visible
   */
  async hasSuccessToast(): Promise<boolean> {
    return this.successToast.isVisible();
  }

  /**
   * Check if error toast is visible
   */
  async hasErrorToast(): Promise<boolean> {
    return this.errorToast.isVisible();
  }

  /**
   * Get error toast message
   */
  async getErrorMessage(): Promise<string> {
    return (await this.errorToast.textContent()) || '';
  }
}
