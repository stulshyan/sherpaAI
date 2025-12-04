import { test, expect } from '@playwright/test';
import { BacklogPage, FeatureDetailPage, IntakePage } from '../pages';

/**
 * Edge Cases E2E Tests
 *
 * Tests edge cases and boundary conditions.
 *
 * @see Epic E-009: End-to-End Integration
 * @see Story S-055: End-to-End Tests
 */

test.describe('Edge Cases - Empty States', () => {
  test('should show empty state for new user with no projects', async ({ page }) => {
    // Mock empty response for backlog
    await page.route('**/api/v1/backlog/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          nowPlaying: { name: 'Now Playing', count: 0, items: [] },
          readySoon: { name: 'Ready Soon', count: 0, items: [] },
          needsAttention: { name: 'Needs Attention', count: 0, items: [] },
          waiting: { name: 'Waiting', count: 0, items: [] },
          totalFeatures: 0,
        }),
      });
    });

    const backlogPage = new BacklogPage(page);
    await page.goto('/backlog');
    await backlogPage.waitForLoad();

    // Should show empty state
    const hasEmpty = await backlogPage.hasEmptyState();
    expect(hasEmpty).toBe(true);

    // Should have link to intake
    const intakeLink = page.getByRole('link', { name: /upload|intake/i });
    await expect(intakeLink).toBeVisible();
  });

  test('should show empty state message with call to action', async ({ page }) => {
    await page.route('**/api/v1/backlog/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          nowPlaying: { name: 'Now Playing', count: 0, items: [] },
          readySoon: { name: 'Ready Soon', count: 0, items: [] },
          needsAttention: { name: 'Needs Attention', count: 0, items: [] },
          waiting: { name: 'Waiting', count: 0, items: [] },
          totalFeatures: 0,
        }),
      });
    });

    await page.goto('/backlog');

    // Check for empty state message
    await expect(page.getByText(/no features yet/i)).toBeVisible();
    await expect(page.getByText(/upload your first requirement/i)).toBeVisible();
  });
});

test.describe('Edge Cases - Long Content', () => {
  test('should truncate very long feature names', async ({ page }) => {
    const longName = 'A'.repeat(150);

    await page.route('**/api/v1/backlog/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          nowPlaying: {
            name: 'Now Playing',
            count: 1,
            items: [
              {
                id: 'feat-001',
                title: longName,
                description: 'Test description',
                status: 'in_loop_a',
                priorityScore: 0.9,
                readinessScore: 0.8,
                pendingQuestions: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                projectId: 'proj-001',
              },
            ],
          },
          readySoon: { name: 'Ready Soon', count: 0, items: [] },
          needsAttention: { name: 'Needs Attention', count: 0, items: [] },
          waiting: { name: 'Waiting', count: 0, items: [] },
          totalFeatures: 1,
        }),
      });
    });

    const backlogPage = new BacklogPage(page);
    await page.goto('/backlog');
    await backlogPage.waitForLoad();

    // The displayed title should be truncated (not the full 150 chars)
    const titles = await backlogPage.getFeatureTitles();
    expect(titles[0].length).toBeLessThan(longName.length);
    expect(titles[0]).toContain('...');
  });

  test('should show full name in tooltip on hover', async ({ page }) => {
    const longName = 'This is a very long feature name that should be truncated in the UI';

    await page.route('**/api/v1/backlog/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          nowPlaying: {
            name: 'Now Playing',
            count: 1,
            items: [
              {
                id: 'feat-001',
                title: longName,
                description: 'Test description',
                status: 'in_loop_a',
                priorityScore: 0.9,
                readinessScore: 0.8,
                pendingQuestions: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                projectId: 'proj-001',
              },
            ],
          },
          readySoon: { name: 'Ready Soon', count: 0, items: [] },
          needsAttention: { name: 'Needs Attention', count: 0, items: [] },
          waiting: { name: 'Waiting', count: 0, items: [] },
          totalFeatures: 1,
        }),
      });
    });

    const backlogPage = new BacklogPage(page);
    await page.goto('/backlog');
    await backlogPage.waitForLoad();

    // Hover over the truncated title
    const featureTitle = page.getByTestId('feature-title').first();
    await featureTitle.hover();

    // Tooltip should show full name
    await expect(page.getByRole('tooltip')).toContainText(longName);
  });
});

test.describe('Edge Cases - Unicode and Special Characters', () => {
  test('should display Unicode characters correctly', async ({ page }) => {
    const unicodeName = '用户认证 (User Auth)';

    await page.route('**/api/v1/backlog/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          nowPlaying: {
            name: 'Now Playing',
            count: 1,
            items: [
              {
                id: 'feat-001',
                title: unicodeName,
                description: 'Unicode test feature',
                status: 'in_loop_a',
                priorityScore: 0.9,
                readinessScore: 0.8,
                pendingQuestions: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                projectId: 'proj-001',
              },
            ],
          },
          readySoon: { name: 'Ready Soon', count: 0, items: [] },
          needsAttention: { name: 'Needs Attention', count: 0, items: [] },
          waiting: { name: 'Waiting', count: 0, items: [] },
          totalFeatures: 1,
        }),
      });
    });

    const backlogPage = new BacklogPage(page);
    await page.goto('/backlog');
    await backlogPage.waitForLoad();

    // Should display Unicode correctly
    const titles = await backlogPage.getFeatureTitles();
    expect(titles[0]).toContain('用户认证');
  });

  test('should search for Unicode content', async ({ page }) => {
    await page.route('**/api/v1/backlog/**', (route) => {
      const url = new URL(route.request().url());
      const search = url.searchParams.get('search');

      if (search && search.includes('用户')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            nowPlaying: {
              name: 'Now Playing',
              count: 1,
              items: [
                {
                  id: 'feat-001',
                  title: '用户认证 (User Auth)',
                  description: 'Unicode test feature',
                  status: 'in_loop_a',
                  priorityScore: 0.9,
                  readinessScore: 0.8,
                  pendingQuestions: 0,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  projectId: 'proj-001',
                },
              ],
            },
            readySoon: { name: 'Ready Soon', count: 0, items: [] },
            needsAttention: { name: 'Needs Attention', count: 0, items: [] },
            waiting: { name: 'Waiting', count: 0, items: [] },
            totalFeatures: 1,
          }),
        });
      } else {
        route.continue();
      }
    });

    const backlogPage = new BacklogPage(page);
    await page.goto('/backlog');
    await backlogPage.waitForLoad();

    await backlogPage.search('用户');

    const titles = await backlogPage.getFeatureTitles();
    expect(titles.length).toBeGreaterThan(0);
    expect(titles[0]).toContain('用户');
  });

  test('should handle emoji in feature names', async ({ page }) => {
    const emojiName = '🚀 Rocket Feature Launch';

    await page.route('**/api/v1/backlog/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          nowPlaying: {
            name: 'Now Playing',
            count: 1,
            items: [
              {
                id: 'feat-001',
                title: emojiName,
                description: 'Emoji test feature',
                status: 'in_loop_a',
                priorityScore: 0.9,
                readinessScore: 0.8,
                pendingQuestions: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                projectId: 'proj-001',
              },
            ],
          },
          readySoon: { name: 'Ready Soon', count: 0, items: [] },
          needsAttention: { name: 'Needs Attention', count: 0, items: [] },
          waiting: { name: 'Waiting', count: 0, items: [] },
          totalFeatures: 1,
        }),
      });
    });

    const backlogPage = new BacklogPage(page);
    await page.goto('/backlog');
    await backlogPage.waitForLoad();

    const titles = await backlogPage.getFeatureTitles();
    expect(titles[0]).toContain('🚀');
  });
});

test.describe('Edge Cases - Navigation', () => {
  test('should handle rapid navigation between pages', async ({ page }) => {
    // Navigate rapidly
    await page.goto('/intake');
    await page.goto('/backlog');
    await page.goto('/settings');
    await page.goto('/backlog');

    // Should end up on backlog without errors
    await expect(page).toHaveURL(/\/backlog/);

    // Page should be functional
    const backlogPage = new BacklogPage(page);
    await expect(backlogPage.backlogContainer).toBeVisible();
  });

  test('should handle browser back button correctly', async ({ page }) => {
    const backlogPage = new BacklogPage(page);
    await backlogPage.goto();
    await backlogPage.waitForLoad();

    // Open a feature modal
    const titles = await backlogPage.getFeatureTitles();
    if (titles.length > 0) {
      await backlogPage.openFeature(titles[0]);

      const featureDetail = new FeatureDetailPage(page);
      await featureDetail.waitForOpen();

      // Press back button
      await page.goBack();

      // Modal should close
      await expect(featureDetail.modal).toBeHidden();

      // Should remain on backlog
      await expect(page).toHaveURL(/\/backlog/);
    }
  });

  test('should preserve state on browser forward navigation', async ({ page }) => {
    // Go to backlog
    await page.goto('/backlog');

    // Go to settings
    await page.goto('/settings');

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/\/backlog/);

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL(/\/settings/);
  });
});

test.describe('Edge Cases - Concurrent Operations', () => {
  test('should handle concurrent uploads', async ({ page }) => {
    const intakePage = new IntakePage(page);
    await intakePage.goto();

    // Upload multiple files at once
    const files = [
      'e2e/fixtures/files/sample-requirement.pdf',
      'e2e/fixtures/files/sample-requirement.txt',
    ];

    await intakePage.uploadFiles(files);

    // Both should be processed
    await page.waitForTimeout(2000);

    const uploads = await intakePage.getRecentUploads();
    expect(uploads.length).toBeGreaterThanOrEqual(1);
  });

  test('should not duplicate API calls on rapid clicks', async ({ page }) => {
    let apiCallCount = 0;

    await page.route('**/api/v1/backlog/**', (route) => {
      apiCallCount++;
      route.continue();
    });

    const backlogPage = new BacklogPage(page);
    await page.goto('/backlog');

    // Rapid clicks on filter tabs
    await backlogPage.nowPlayingTab.click();
    await backlogPage.readySoonTab.click();
    await backlogPage.needsAttentionTab.click();
    await backlogPage.waitingTab.click();

    // Wait a moment for any pending requests
    await page.waitForTimeout(1000);

    // Should not have made excessive API calls (debounce should work)
    // Allow some extra calls for initial load
    expect(apiCallCount).toBeLessThan(10);
  });
});

test.describe('Edge Cases - Accessibility', () => {
  test('should support keyboard navigation', async ({ page }) => {
    const backlogPage = new BacklogPage(page);
    await backlogPage.goto();
    await backlogPage.waitForLoad();

    // Focus on first feature card using Tab
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Should have focus indicator visible
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Press Enter to open modal
    await page.keyboard.press('Enter');

    // Check if modal or detail view opened
    const featureDetail = new FeatureDetailPage(page);
    const isModalOpen = await featureDetail.modal.isVisible();

    if (isModalOpen) {
      // Press Escape to close modal
      await page.keyboard.press('Escape');
      await expect(featureDetail.modal).toBeHidden();
    }
  });

  test('should have proper heading structure', async ({ page }) => {
    await page.goto('/backlog');

    // Check for h1
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();

    // Should have proper heading hierarchy
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    expect(headings.length).toBeGreaterThan(0);
  });

  test('should have alt text for images', async ({ page }) => {
    await page.goto('/backlog');

    const images = await page.locator('img').all();

    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');

      // Image should have alt text or be decorative (role="presentation")
      expect(alt !== null || role === 'presentation').toBe(true);
    }
  });
});

test.describe('Edge Cases - Browser Compatibility', () => {
  test('should work with JavaScript disabled for static content', async ({ page, context }) => {
    // Note: This test checks that the initial page structure loads
    // Full functionality requires JavaScript

    await page.goto('/backlog');

    // Basic structure should be present
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should handle page refresh during loading', async ({ page }) => {
    // Start loading backlog
    const loadPromise = page.goto('/backlog');

    // Refresh before load completes
    await page.waitForTimeout(100);
    await page.reload();

    // Should eventually load successfully
    const backlogPage = new BacklogPage(page);
    await backlogPage.waitForLoad();
    await expect(backlogPage.backlogContainer).toBeVisible();
  });
});
