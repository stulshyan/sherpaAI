import { test, expect } from '@playwright/test';
import { SettingsPage } from '../pages';

/**
 * Settings E2E Tests
 *
 * Tests the settings page for model configuration and API key management.
 *
 * @see Epic E-009: End-to-End Integration
 * @see Story S-055: End-to-End Tests
 */

test.describe('Settings - Model Configuration', () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);
    await settingsPage.goto();
  });

  test('should display settings page', async () => {
    await expect(settingsPage.container).toBeVisible();
  });

  test('should display current model selection', async () => {
    const currentModel = await settingsPage.getCurrentModel();
    expect(currentModel).toBeTruthy();
    expect(currentModel.length).toBeGreaterThan(0);
  });

  test('should display model selector dropdown', async () => {
    await expect(settingsPage.modelSelector).toBeVisible();
  });

  test('should change model selection @critical', async ({ page }) => {
    const initialModel = await settingsPage.getCurrentModel();

    // Open selector and pick a different model
    await settingsPage.modelSelector.click();

    // Find a different model option
    const modelOptions = page.locator('[data-testid^="model-option-"]');
    const optionCount = await modelOptions.count();

    if (optionCount > 1) {
      // Click on a different model than the current one
      for (let i = 0; i < optionCount; i++) {
        const option = modelOptions.nth(i);
        const optionText = await option.textContent();
        if (optionText && !optionText.includes(initialModel)) {
          await option.click();
          break;
        }
      }

      // Verify change
      const newModel = await settingsPage.getCurrentModel();
      expect(newModel).not.toBe(initialModel);
    }
  });

  test('should save configuration successfully @critical', async () => {
    await settingsPage.save();

    const hasSuccess = await settingsPage.hasSuccessToast();
    expect(hasSuccess).toBe(true);
  });

  test('should persist model selection after save', async ({ page }) => {
    // Change model
    await settingsPage.modelSelector.click();
    const modelOptions = page.locator('[data-testid^="model-option-"]');
    await modelOptions.first().click();

    const selectedModel = await settingsPage.getCurrentModel();

    // Save
    await settingsPage.save();

    // Reload page
    await page.reload();
    await settingsPage.goto();

    // Verify persisted
    const persistedModel = await settingsPage.getCurrentModel();
    expect(persistedModel).toBe(selectedModel);
  });
});

test.describe('Settings - Fallback Chain', () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);
    await settingsPage.goto();
  });

  test('should display fallback chain', async () => {
    await expect(settingsPage.fallbackChain).toBeVisible();

    const chain = await settingsPage.getFallbackChain();
    expect(chain.length).toBeGreaterThanOrEqual(0);
  });

  test('should add model to fallback chain', async ({ page }) => {
    const initialChain = await settingsPage.getFallbackChain();

    // Add a model
    await page.getByTestId('add-fallback').click();
    const fallbackOptions = page.locator('[data-testid^="fallback-option-"]');
    const optionCount = await fallbackOptions.count();

    if (optionCount > 0) {
      await fallbackOptions.first().click();

      const newChain = await settingsPage.getFallbackChain();
      expect(newChain.length).toBe(initialChain.length + 1);
    }
  });

  test('should remove model from fallback chain', async ({ page }) => {
    const initialChain = await settingsPage.getFallbackChain();

    if (initialChain.length > 0) {
      // Remove first fallback
      const removeButtons = page.locator('[data-testid^="remove-fallback-"]');
      await removeButtons.first().click();

      const newChain = await settingsPage.getFallbackChain();
      expect(newChain.length).toBe(initialChain.length - 1);
    }
  });
});

test.describe('Settings - API Keys', () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);
    await settingsPage.goto();
  });

  test('should display API key inputs', async () => {
    await expect(settingsPage.anthropicKeyInput).toBeVisible();
    await expect(settingsPage.openaiKeyInput).toBeVisible();
    await expect(settingsPage.googleKeyInput).toBeVisible();
  });

  test('should mask API key input', async () => {
    // API key inputs should be password type or masked
    const inputType = await settingsPage.anthropicKeyInput.getAttribute('type');
    expect(inputType).toBe('password');
  });

  test('should display API key status', async () => {
    const anthropicStatus = await settingsPage.getApiKeyStatus('anthropic');
    expect(['valid', 'invalid', 'not-set']).toContain(anthropicStatus);
  });

  test('should test API connection', async () => {
    // This test requires a valid API key to be set
    const status = await settingsPage.getApiKeyStatus('anthropic');

    if (status === 'valid') {
      const isConnected = await settingsPage.testConnection('anthropic');
      expect(isConnected).toBe(true);
    } else {
      // Skip if no valid key
      test.skip(true, 'No valid Anthropic API key configured');
    }
  });

  test('should not expose API key in UI', async ({ page }) => {
    // Set a fake API key
    await settingsPage.setApiKey('anthropic', 'sk-test-1234567890');

    // Check that the key is not visible in the DOM
    const pageContent = await page.content();
    expect(pageContent).not.toContain('sk-test-1234567890');
  });
});

test.describe('Settings - Validation', () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);
    await settingsPage.goto();
  });

  test('should show error for invalid API key format', async ({ page }) => {
    // Enter an invalid API key format
    await settingsPage.setApiKey('anthropic', 'invalid-key');

    // Try to save
    await settingsPage.save();

    // Should show error
    const hasError = await settingsPage.hasErrorToast();
    if (hasError) {
      const errorMessage = await settingsPage.getErrorMessage();
      expect(errorMessage.toLowerCase()).toContain('invalid');
    }
  });

  test('should require at least one model in fallback chain', async ({ page }) => {
    // Remove all fallback models
    const chain = await settingsPage.getFallbackChain();

    for (let i = 0; i < chain.length; i++) {
      const removeButtons = page.locator('[data-testid^="remove-fallback-"]');
      const count = await removeButtons.count();
      if (count > 0) {
        await removeButtons.first().click();
      }
    }

    // Try to save
    await settingsPage.save();

    // Should show validation error or prevent removal of last item
    const finalChain = await settingsPage.getFallbackChain();
    expect(finalChain.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Settings - Persistence', () => {
  test('should load saved settings on page refresh', async ({ page }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();

    // Get current settings
    const currentModel = await settingsPage.getCurrentModel();
    const currentChain = await settingsPage.getFallbackChain();

    // Refresh page
    await page.reload();

    // Verify settings are still loaded
    const modelAfterRefresh = await settingsPage.getCurrentModel();
    const chainAfterRefresh = await settingsPage.getFallbackChain();

    expect(modelAfterRefresh).toBe(currentModel);
    expect(chainAfterRefresh).toEqual(currentChain);
  });

  test('should update settings across sessions', async ({ page, context }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();

    // Change model
    await settingsPage.modelSelector.click();
    const modelOptions = page.locator('[data-testid^="model-option-"]');
    await modelOptions.first().click();

    const selectedModel = await settingsPage.getCurrentModel();
    await settingsPage.save();

    // Open new page in same context
    const newPage = await context.newPage();
    const newSettingsPage = new SettingsPage(newPage);
    await newSettingsPage.goto();

    // Verify same settings
    const modelInNewPage = await newSettingsPage.getCurrentModel();
    expect(modelInNewPage).toBe(selectedModel);
  });
});
