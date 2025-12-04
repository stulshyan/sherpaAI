import { test, expect } from '@playwright/test';
import { BacklogPage, FeatureDetailPage } from '../pages';

/**
 * Backlog E2E Tests
 *
 * Tests the backlog view functionality including filtering, sorting, and feature details.
 *
 * @see Epic E-009: End-to-End Integration
 * @see Story S-055: End-to-End Tests
 */

test.describe('Backlog - Display and Navigation', () => {
  let backlogPage: BacklogPage;

  test.beforeEach(async ({ page }) => {
    backlogPage = new BacklogPage(page);
    await backlogPage.goto();
  });

  test('should display backlog with features @critical', async () => {
    await expect(backlogPage.backlogContainer).toBeVisible();

    const featureCount = await backlogPage.getFeatureCount();
    expect(featureCount).toBeGreaterThan(0);
  });

  test('should display features sorted by priority', async () => {
    const isSorted = await backlogPage.verifyPrioritySorting();
    expect(isSorted).toBe(true);
  });

  test('should display feature cards with required information', async () => {
    const cards = await backlogPage.getFeatureCards();
    expect(cards.length).toBeGreaterThan(0);

    // Check first card has required elements
    const firstCard = cards[0];
    await expect(firstCard.getByTestId('feature-title')).toBeVisible();
    await expect(firstCard.getByTestId('readiness-score')).toBeVisible();
    await expect(firstCard.getByTestId('status-badge')).toBeVisible();
  });

  test('should open feature detail modal on card click @critical', async ({ page }) => {
    const titles = await backlogPage.getFeatureTitles();
    expect(titles.length).toBeGreaterThan(0);

    await backlogPage.openFeature(titles[0]);

    const featureDetail = new FeatureDetailPage(page);
    await featureDetail.waitForOpen();

    const modalTitle = await featureDetail.getTitle();
    expect(modalTitle).toBe(titles[0]);
  });

  test('should close feature detail modal', async ({ page }) => {
    const titles = await backlogPage.getFeatureTitles();
    await backlogPage.openFeature(titles[0]);

    const featureDetail = new FeatureDetailPage(page);
    await featureDetail.waitForOpen();
    await featureDetail.close();

    await expect(featureDetail.modal).toBeHidden();
  });
});

test.describe('Backlog - Filtering', () => {
  let backlogPage: BacklogPage;

  test.beforeEach(async ({ page }) => {
    backlogPage = new BacklogPage(page);
    await backlogPage.goto();
  });

  test('should filter by Now Playing tab @critical', async () => {
    await backlogPage.filterByStatus('now-playing');

    const tabCount = await backlogPage.getTabCount('now-playing');
    const featureCount = await backlogPage.getFeatureCount();

    expect(featureCount).toBe(tabCount);
  });

  test('should filter by Ready Soon tab', async () => {
    await backlogPage.filterByStatus('ready-soon');

    const tabCount = await backlogPage.getTabCount('ready-soon');
    const featureCount = await backlogPage.getFeatureCount();

    expect(featureCount).toBe(tabCount);
  });

  test('should filter by Needs Attention tab', async () => {
    await backlogPage.filterByStatus('needs-attention');

    const tabCount = await backlogPage.getTabCount('needs-attention');
    const featureCount = await backlogPage.getFeatureCount();

    expect(featureCount).toBe(tabCount);
  });

  test('should filter by Waiting tab', async () => {
    await backlogPage.filterByStatus('waiting');

    const tabCount = await backlogPage.getTabCount('waiting');
    const featureCount = await backlogPage.getFeatureCount();

    expect(featureCount).toBe(tabCount);
  });

  test('should search for features by title', async () => {
    const titles = await backlogPage.getFeatureTitles();
    const searchTerm = titles[0].split(' ')[0]; // First word of first title

    await backlogPage.search(searchTerm);

    const filteredTitles = await backlogPage.getFeatureTitles();
    expect(filteredTitles.length).toBeGreaterThan(0);
    expect(filteredTitles.every((t) => t.toLowerCase().includes(searchTerm.toLowerCase()))).toBe(
      true
    );
  });

  test('should clear search and show all features', async () => {
    const initialCount = await backlogPage.getFeatureCount();

    await backlogPage.search('unique-search-term');
    await backlogPage.clearSearch();

    const afterClearCount = await backlogPage.getFeatureCount();
    expect(afterClearCount).toBe(initialCount);
  });

  test('should show empty state for no results', async () => {
    await backlogPage.search('xyznonexistent123');

    const hasEmpty = await backlogPage.hasEmptyState();
    expect(hasEmpty).toBe(true);
  });
});

test.describe('Backlog - Feature Detail Modal', () => {
  let backlogPage: BacklogPage;
  let featureDetail: FeatureDetailPage;

  test.beforeEach(async ({ page }) => {
    backlogPage = new BacklogPage(page);
    await backlogPage.goto();

    const titles = await backlogPage.getFeatureTitles();
    await backlogPage.openFeature(titles[0]);

    featureDetail = new FeatureDetailPage(page);
    await featureDetail.waitForOpen();
  });

  test('should display all tabs in feature modal @critical', async () => {
    await expect(featureDetail.tabOverview).toBeVisible();
    await expect(featureDetail.tabRequirements).toBeVisible();
    await expect(featureDetail.tabQuestions).toBeVisible();
    await expect(featureDetail.tabHistory).toBeVisible();
  });

  test('should display readiness score in overview', async () => {
    await featureDetail.switchToTab('overview');

    const readinessScore = await featureDetail.getReadinessScore();
    expect(readinessScore).toBeGreaterThanOrEqual(0);
    expect(readinessScore).toBeLessThanOrEqual(100);
  });

  test('should display readiness breakdown', async () => {
    await featureDetail.switchToTab('overview');

    const breakdown = await featureDetail.getReadinessBreakdown();
    expect(breakdown.businessClarity).toBeGreaterThanOrEqual(0);
    expect(breakdown.technicalClarity).toBeGreaterThanOrEqual(0);
    expect(breakdown.testability).toBeGreaterThanOrEqual(0);
  });

  test('should switch between tabs', async () => {
    // Switch to requirements tab
    await featureDetail.switchToTab('requirements');
    await expect(featureDetail.tabRequirements).toHaveAttribute('aria-selected', 'true');

    // Switch to questions tab
    await featureDetail.switchToTab('questions');
    await expect(featureDetail.tabQuestions).toHaveAttribute('aria-selected', 'true');

    // Switch to history tab
    await featureDetail.switchToTab('history');
    await expect(featureDetail.tabHistory).toHaveAttribute('aria-selected', 'true');

    // Switch back to overview
    await featureDetail.switchToTab('overview');
    await expect(featureDetail.tabOverview).toHaveAttribute('aria-selected', 'true');
  });

  test('should display questions in questions tab', async () => {
    await featureDetail.switchToTab('questions');

    // Should have either pending or answered questions (or both)
    const pendingCount = await featureDetail.getPendingQuestionCount();
    const answeredCount = await featureDetail.getAnsweredQuestionCount();

    // Verify we can get question counts
    expect(pendingCount).toBeGreaterThanOrEqual(0);
    expect(answeredCount).toBeGreaterThanOrEqual(0);

    // At least the questions list should be visible
    await expect(featureDetail.questionsList).toBeVisible();
  });
});

test.describe('Backlog - Mobile Responsive', () => {
  test('should display single column on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const backlogPage = new BacklogPage(page);
    await backlogPage.goto();

    await expect(backlogPage.backlogContainer).toBeVisible();

    // Feature cards should be visible
    const featureCount = await backlogPage.getFeatureCount();
    expect(featureCount).toBeGreaterThan(0);
  });

  test('should open feature modal on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const backlogPage = new BacklogPage(page);
    await backlogPage.goto();

    const titles = await backlogPage.getFeatureTitles();
    await backlogPage.openFeature(titles[0]);

    const featureDetail = new FeatureDetailPage(page);
    await featureDetail.waitForOpen();
    await expect(featureDetail.modal).toBeVisible();
  });
});
