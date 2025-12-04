import { Page, Locator, expect } from '@playwright/test';

/**
 * Backlog Page Object
 *
 * Encapsulates interactions with the Backlog page.
 *
 * @see Epic E-009: End-to-End Integration
 */
export class BacklogPage {
  readonly page: Page;

  // Locators
  readonly backlogContainer: Locator;
  readonly featureCards: Locator;
  readonly featureModal: Locator;
  readonly searchInput: Locator;
  readonly filterTabs: Locator;
  readonly emptyState: Locator;
  readonly loadingSpinner: Locator;

  // Tab locators
  readonly nowPlayingTab: Locator;
  readonly readySoonTab: Locator;
  readonly needsAttentionTab: Locator;
  readonly waitingTab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.backlogContainer = page.getByTestId('backlog-container');
    this.featureCards = page.getByTestId('feature-card');
    this.featureModal = page.getByTestId('feature-modal');
    this.searchInput = page.getByTestId('search-input');
    this.filterTabs = page.getByTestId('filter-tabs');
    this.emptyState = page.getByTestId('empty-state');
    this.loadingSpinner = page.getByTestId('loading-spinner');

    // Tab locators
    this.nowPlayingTab = page.getByTestId('tab-now-playing');
    this.readySoonTab = page.getByTestId('tab-ready-soon');
    this.needsAttentionTab = page.getByTestId('tab-needs-attention');
    this.waitingTab = page.getByTestId('tab-waiting');
  }

  /**
   * Navigate to the Backlog page
   */
  async goto(): Promise<void> {
    await this.page.goto('/backlog');
    await this.waitForLoad();
  }

  /**
   * Wait for the backlog to load
   */
  async waitForLoad(): Promise<void> {
    await expect(this.loadingSpinner).toBeHidden({ timeout: 10000 });
    await expect(this.backlogContainer).toBeVisible();
  }

  /**
   * Get all visible feature cards
   */
  async getFeatureCards(): Promise<Locator[]> {
    return this.featureCards.all();
  }

  /**
   * Get the count of visible features
   */
  async getFeatureCount(): Promise<number> {
    return this.featureCards.count();
  }

  /**
   * Click on a feature card by title
   */
  async openFeature(title: string): Promise<void> {
    await this.page.locator(`[data-testid="feature-card"]:has-text("${title}")`).click();
    await expect(this.featureModal).toBeVisible();
  }

  /**
   * Close the feature modal
   */
  async closeFeatureModal(): Promise<void> {
    await this.page.getByTestId('modal-close').click();
    await expect(this.featureModal).toBeHidden();
  }

  /**
   * Filter by status tab
   */
  async filterByStatus(
    status: 'now-playing' | 'ready-soon' | 'needs-attention' | 'waiting'
  ): Promise<void> {
    const tabMap = {
      'now-playing': this.nowPlayingTab,
      'ready-soon': this.readySoonTab,
      'needs-attention': this.needsAttentionTab,
      waiting: this.waitingTab,
    };

    await tabMap[status].click();
    await this.waitForLoad();
  }

  /**
   * Search for features
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
    await this.waitForLoad();
  }

  /**
   * Clear search
   */
  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
    await this.waitForLoad();
  }

  /**
   * Get feature titles from visible cards
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
   * Get readiness scores from visible cards
   */
  async getReadinessScores(): Promise<number[]> {
    const cards = await this.featureCards.all();
    return Promise.all(
      cards.map(async (card) => {
        const scoreText = await card.getByTestId('readiness-score').textContent();
        return parseInt(scoreText || '0', 10);
      })
    );
  }

  /**
   * Check if empty state is displayed
   */
  async hasEmptyState(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  /**
   * Get tab badge count
   */
  async getTabCount(
    tab: 'now-playing' | 'ready-soon' | 'needs-attention' | 'waiting'
  ): Promise<number> {
    const tabMap = {
      'now-playing': this.nowPlayingTab,
      'ready-soon': this.readySoonTab,
      'needs-attention': this.needsAttentionTab,
      waiting: this.waitingTab,
    };

    const badge = tabMap[tab].getByTestId('tab-count');
    const text = await badge.textContent();
    return parseInt(text || '0', 10);
  }

  /**
   * Verify features are sorted by priority (descending)
   */
  async verifyPrioritySorting(): Promise<boolean> {
    const cards = await this.featureCards.all();
    const scores: number[] = [];

    for (const card of cards) {
      const scoreText = await card.getByTestId('priority-score').textContent();
      scores.push(parseFloat(scoreText || '0'));
    }

    // Check if sorted in descending order
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] > scores[i - 1]) {
        return false;
      }
    }

    return true;
  }
}
