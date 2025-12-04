import { Page, Locator, expect } from '@playwright/test';

/**
 * Feature Detail Modal Page Object
 *
 * Encapsulates interactions with the Feature Detail modal.
 *
 * @see Epic E-009: End-to-End Integration
 */
export class FeatureDetailPage {
  readonly page: Page;

  // Modal container
  readonly modal: Locator;
  readonly closeButton: Locator;

  // Tabs
  readonly tabOverview: Locator;
  readonly tabRequirements: Locator;
  readonly tabQuestions: Locator;
  readonly tabHistory: Locator;

  // Overview tab elements
  readonly featureTitle: Locator;
  readonly featureDescription: Locator;
  readonly readinessScore: Locator;
  readonly priorityScore: Locator;
  readonly statusBadge: Locator;
  readonly themeBadge: Locator;

  // Readiness breakdown
  readonly businessClarity: Locator;
  readonly technicalClarity: Locator;
  readonly testability: Locator;

  // Questions tab elements
  readonly questionsList: Locator;
  readonly pendingQuestions: Locator;
  readonly answeredQuestions: Locator;

  // Question interaction elements
  readonly yesButton: Locator;
  readonly noButton: Locator;
  readonly textInput: Locator;
  readonly multipleChoiceOptions: Locator;
  readonly submitAnswerButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.getByTestId('feature-modal');
    this.closeButton = page.getByTestId('modal-close');

    // Tabs
    this.tabOverview = page.getByTestId('tab-overview');
    this.tabRequirements = page.getByTestId('tab-requirements');
    this.tabQuestions = page.getByTestId('tab-questions');
    this.tabHistory = page.getByTestId('tab-history');

    // Overview elements
    this.featureTitle = page.getByTestId('feature-title');
    this.featureDescription = page.getByTestId('feature-description');
    this.readinessScore = page.getByTestId('readiness-score');
    this.priorityScore = page.getByTestId('priority-score');
    this.statusBadge = page.getByTestId('status-badge');
    this.themeBadge = page.getByTestId('theme-badge');

    // Readiness breakdown
    this.businessClarity = page.getByTestId('business-clarity');
    this.technicalClarity = page.getByTestId('technical-clarity');
    this.testability = page.getByTestId('testability');

    // Questions elements
    this.questionsList = page.getByTestId('questions-list');
    this.pendingQuestions = page.getByTestId('pending-question');
    this.answeredQuestions = page.getByTestId('answered-question');

    // Question interaction
    this.yesButton = page.getByTestId('answer-yes');
    this.noButton = page.getByTestId('answer-no');
    this.textInput = page.getByTestId('answer-text-input');
    this.multipleChoiceOptions = page.getByTestId('answer-option');
    this.submitAnswerButton = page.getByTestId('submit-answer');
  }

  /**
   * Wait for modal to be visible
   */
  async waitForOpen(): Promise<void> {
    await expect(this.modal).toBeVisible();
  }

  /**
   * Close the modal
   */
  async close(): Promise<void> {
    await this.closeButton.click();
    await expect(this.modal).toBeHidden();
  }

  /**
   * Switch to a specific tab
   */
  async switchToTab(tab: 'overview' | 'requirements' | 'questions' | 'history'): Promise<void> {
    const tabMap = {
      overview: this.tabOverview,
      requirements: this.tabRequirements,
      questions: this.tabQuestions,
      history: this.tabHistory,
    };

    await tabMap[tab].click();
  }

  /**
   * Get the feature title
   */
  async getTitle(): Promise<string> {
    return (await this.featureTitle.textContent()) || '';
  }

  /**
   * Get the readiness score
   */
  async getReadinessScore(): Promise<number> {
    const text = await this.readinessScore.textContent();
    return parseInt(text?.replace('%', '') || '0', 10);
  }

  /**
   * Get the priority score
   */
  async getPriorityScore(): Promise<number> {
    const text = await this.priorityScore.textContent();
    return parseFloat(text || '0');
  }

  /**
   * Get the current status
   */
  async getStatus(): Promise<string> {
    return (await this.statusBadge.textContent()) || '';
  }

  /**
   * Get pending question count
   */
  async getPendingQuestionCount(): Promise<number> {
    return this.pendingQuestions.count();
  }

  /**
   * Get answered question count
   */
  async getAnsweredQuestionCount(): Promise<number> {
    return this.answeredQuestions.count();
  }

  /**
   * Answer a yes/no question
   */
  async answerYesNo(answer: 'yes' | 'no'): Promise<void> {
    const button = answer === 'yes' ? this.yesButton : this.noButton;
    await button.click();

    // Wait for the answer to be saved
    await expect(this.page.getByTestId('answer-saved')).toBeVisible({ timeout: 5000 });
  }

  /**
   * Answer a text question
   */
  async answerText(text: string): Promise<void> {
    await this.textInput.fill(text);
    await this.submitAnswerButton.click();

    // Wait for the answer to be saved
    await expect(this.page.getByTestId('answer-saved')).toBeVisible({ timeout: 5000 });
  }

  /**
   * Answer a multiple choice question
   */
  async answerMultipleChoice(options: string[]): Promise<void> {
    for (const option of options) {
      await this.page.locator(`[data-testid="answer-option"]:has-text("${option}")`).click();
    }
    await this.submitAnswerButton.click();

    // Wait for the answer to be saved
    await expect(this.page.getByTestId('answer-saved')).toBeVisible({ timeout: 5000 });
  }

  /**
   * Get readiness breakdown scores
   */
  async getReadinessBreakdown(): Promise<{
    businessClarity: number;
    technicalClarity: number;
    testability: number;
  }> {
    const [bc, tc, t] = await Promise.all([
      this.businessClarity.textContent(),
      this.technicalClarity.textContent(),
      this.testability.textContent(),
    ]);

    return {
      businessClarity: parseInt(bc?.replace('%', '') || '0', 10),
      technicalClarity: parseInt(tc?.replace('%', '') || '0', 10),
      testability: parseInt(t?.replace('%', '') || '0', 10),
    };
  }

  /**
   * Get the first pending question text
   */
  async getFirstPendingQuestion(): Promise<string> {
    const firstQuestion = this.pendingQuestions.first();
    return (await firstQuestion.getByTestId('question-text').textContent()) || '';
  }
}
