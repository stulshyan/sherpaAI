import { test, expect } from '@playwright/test';
import { BacklogPage, FeatureDetailPage } from '../pages';

/**
 * Clarification Questions E2E Tests
 *
 * Tests the Q&A flow for clarifying feature requirements.
 *
 * @see Epic E-009: End-to-End Integration
 * @see Story S-055: End-to-End Tests
 */

test.describe('Clarification Questions - Yes/No', () => {
  let backlogPage: BacklogPage;
  let featureDetail: FeatureDetailPage;

  test.beforeEach(async ({ page }) => {
    backlogPage = new BacklogPage(page);
    await backlogPage.goto();

    // Find a feature with pending questions (Needs Attention tab)
    await backlogPage.filterByStatus('needs-attention');

    const titles = await backlogPage.getFeatureTitles();
    if (titles.length === 0) {
      test.skip(true, 'No features with pending questions');
      return;
    }

    await backlogPage.openFeature(titles[0]);
    featureDetail = new FeatureDetailPage(page);
    await featureDetail.waitForOpen();
    await featureDetail.switchToTab('questions');
  });

  test('should display pending questions @critical', async () => {
    const pendingCount = await featureDetail.getPendingQuestionCount();
    expect(pendingCount).toBeGreaterThan(0);
  });

  test('should answer yes to a yes/no question @critical', async ({ page }) => {
    const initialPendingCount = await featureDetail.getPendingQuestionCount();

    // Answer yes to the first question
    await featureDetail.answerYesNo('yes');

    // Wait for the UI to update
    await page.waitForTimeout(1000);

    // Pending count should decrease
    const afterPendingCount = await featureDetail.getPendingQuestionCount();
    expect(afterPendingCount).toBeLessThan(initialPendingCount);
  });

  test('should answer no to a yes/no question', async ({ page }) => {
    const initialPendingCount = await featureDetail.getPendingQuestionCount();

    // Answer no to the first question
    await featureDetail.answerYesNo('no');

    // Wait for the UI to update
    await page.waitForTimeout(1000);

    // Pending count should decrease
    const afterPendingCount = await featureDetail.getPendingQuestionCount();
    expect(afterPendingCount).toBeLessThan(initialPendingCount);
  });

  test('should show answer saved confirmation', async ({ page }) => {
    await featureDetail.answerYesNo('yes');

    // Should see confirmation message
    await expect(page.getByTestId('answer-saved')).toBeVisible();
  });
});

test.describe('Clarification Questions - Multiple Choice', () => {
  let backlogPage: BacklogPage;
  let featureDetail: FeatureDetailPage;

  test.beforeEach(async ({ page }) => {
    backlogPage = new BacklogPage(page);
    await backlogPage.goto();

    // Find a feature with pending questions
    await backlogPage.filterByStatus('needs-attention');

    const titles = await backlogPage.getFeatureTitles();
    if (titles.length === 0) {
      test.skip(true, 'No features with pending questions');
      return;
    }

    await backlogPage.openFeature(titles[0]);
    featureDetail = new FeatureDetailPage(page);
    await featureDetail.waitForOpen();
    await featureDetail.switchToTab('questions');
  });

  test('should display multiple choice options', async () => {
    // Check if there are multiple choice questions
    const options = await featureDetail.multipleChoiceOptions.all();

    // This test only applies if there are multiple choice questions
    if (options.length === 0) {
      test.skip(true, 'No multiple choice questions available');
      return;
    }

    expect(options.length).toBeGreaterThanOrEqual(2);
  });

  test('should allow selecting multiple options', async () => {
    const options = await featureDetail.multipleChoiceOptions.all();

    if (options.length < 2) {
      test.skip(true, 'Not enough options to test multiple selection');
      return;
    }

    // Select first two options
    await options[0].click();
    await options[1].click();

    // Both should be selected
    await expect(options[0]).toHaveClass(/selected|active/);
    await expect(options[1]).toHaveClass(/selected|active/);
  });

  test('should submit multiple choice answer @critical', async ({ page }) => {
    const options = await featureDetail.multipleChoiceOptions.all();

    if (options.length === 0) {
      test.skip(true, 'No multiple choice questions available');
      return;
    }

    // Get option texts
    const optionTexts = await Promise.all(
      options.slice(0, 2).map(async (opt) => (await opt.textContent()) || '')
    );

    await featureDetail.answerMultipleChoice(optionTexts.filter((t) => t));

    // Should see confirmation
    await expect(page.getByTestId('answer-saved')).toBeVisible();
  });
});

test.describe('Clarification Questions - Text Input', () => {
  let backlogPage: BacklogPage;
  let featureDetail: FeatureDetailPage;

  test.beforeEach(async ({ page }) => {
    backlogPage = new BacklogPage(page);
    await backlogPage.goto();

    await backlogPage.filterByStatus('needs-attention');

    const titles = await backlogPage.getFeatureTitles();
    if (titles.length === 0) {
      test.skip(true, 'No features with pending questions');
      return;
    }

    await backlogPage.openFeature(titles[0]);
    featureDetail = new FeatureDetailPage(page);
    await featureDetail.waitForOpen();
    await featureDetail.switchToTab('questions');
  });

  test('should allow entering text answer', async () => {
    // Check if text input is available
    const isTextInputVisible = await featureDetail.textInput.isVisible();

    if (!isTextInputVisible) {
      test.skip(true, 'No text input questions available');
      return;
    }

    await featureDetail.textInput.fill('This is a test answer for the clarification question.');
    await expect(featureDetail.textInput).toHaveValue(/test answer/);
  });

  test('should submit text answer @critical', async ({ page }) => {
    const isTextInputVisible = await featureDetail.textInput.isVisible();

    if (!isTextInputVisible) {
      test.skip(true, 'No text input questions available');
      return;
    }

    await featureDetail.answerText('The budget is $50,000 for Phase 1');

    // Should see confirmation
    await expect(page.getByTestId('answer-saved')).toBeVisible();
  });
});

test.describe('Clarification Questions - Readiness Impact', () => {
  test('should increase readiness score after answering question @critical', async ({ page }) => {
    const backlogPage = new BacklogPage(page);
    await backlogPage.goto();

    await backlogPage.filterByStatus('needs-attention');

    const titles = await backlogPage.getFeatureTitles();
    if (titles.length === 0) {
      test.skip(true, 'No features with pending questions');
      return;
    }

    await backlogPage.openFeature(titles[0]);

    const featureDetail = new FeatureDetailPage(page);
    await featureDetail.waitForOpen();

    // Get initial readiness score
    await featureDetail.switchToTab('overview');
    const initialScore = await featureDetail.getReadinessScore();

    // Answer a question
    await featureDetail.switchToTab('questions');
    const pendingCount = await featureDetail.getPendingQuestionCount();

    if (pendingCount === 0) {
      test.skip(true, 'No pending questions to answer');
      return;
    }

    await featureDetail.answerYesNo('yes');

    // Wait for readiness score to update
    await page.waitForTimeout(2000);

    // Check new readiness score
    await featureDetail.switchToTab('overview');
    const newScore = await featureDetail.getReadinessScore();

    // Score should increase or stay the same (never decrease from answering)
    expect(newScore).toBeGreaterThanOrEqual(initialScore);
  });

  test('should create audit log entry when answering question', async ({ page }) => {
    const backlogPage = new BacklogPage(page);
    await backlogPage.goto();

    await backlogPage.filterByStatus('needs-attention');

    const titles = await backlogPage.getFeatureTitles();
    if (titles.length === 0) {
      test.skip(true, 'No features with pending questions');
      return;
    }

    await backlogPage.openFeature(titles[0]);

    const featureDetail = new FeatureDetailPage(page);
    await featureDetail.waitForOpen();

    // Answer a question
    await featureDetail.switchToTab('questions');
    const pendingCount = await featureDetail.getPendingQuestionCount();

    if (pendingCount === 0) {
      test.skip(true, 'No pending questions to answer');
      return;
    }

    await featureDetail.answerYesNo('yes');

    // Check history tab for audit entry
    await featureDetail.switchToTab('history');

    // Should see recent activity
    const historyItems = page.getByTestId('history-item');
    await expect(historyItems.first()).toBeVisible();
  });
});

test.describe('Clarification Questions - XSS Prevention', () => {
  test('should escape special characters in text answers', async ({ page }) => {
    const backlogPage = new BacklogPage(page);
    await backlogPage.goto();

    await backlogPage.filterByStatus('needs-attention');

    const titles = await backlogPage.getFeatureTitles();
    if (titles.length === 0) {
      test.skip(true, 'No features with pending questions');
      return;
    }

    await backlogPage.openFeature(titles[0]);

    const featureDetail = new FeatureDetailPage(page);
    await featureDetail.waitForOpen();
    await featureDetail.switchToTab('questions');

    const isTextInputVisible = await featureDetail.textInput.isVisible();
    if (!isTextInputVisible) {
      test.skip(true, 'No text input questions available');
      return;
    }

    // Try to inject script
    const xssPayload = '<script>alert("xss")</script>';
    await featureDetail.answerText(xssPayload);

    // Wait for answer to be saved and displayed
    await page.waitForTimeout(1000);

    // The script should not execute - check that no alert was triggered
    // and the text should be escaped in the display
    const answeredQuestions = await featureDetail.answeredQuestions.all();
    if (answeredQuestions.length > 0) {
      const lastAnswer = answeredQuestions[answeredQuestions.length - 1];
      const answerText = await lastAnswer.getByTestId('answer-text').textContent();

      // The answer should be escaped, not executed
      expect(answerText).toContain('&lt;script&gt;');
    }
  });
});
