import { delay, http, HttpResponse } from 'msw';

// Mock settings data
const mockSettings = {
  project: {
    id: 'proj-abc123',
    name: 'E-Commerce Platform Rebuild',
    description:
      'Complete rewrite of legacy e-commerce platform with modern architecture, improved performance, and enhanced security features.',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T14:32:00Z',
    owner: {
      id: 'user-001',
      name: 'Sarah Chen',
      email: 'sarah@company.com',
    },
  },
  models: [
    {
      agentType: 'decomposer',
      agentName: 'Decomposer Agent',
      model: {
        id: 'claude-sonnet-4-5-20250929',
        name: 'Claude Sonnet 4',
        provider: 'anthropic',
        version: '4.5',
        contextWindow: 200000,
        costPer1kInput: 0.003,
        costPer1kOutput: 0.015,
      },
      status: 'connected',
      lastUsed: '2024-01-20T14:00:00Z',
      totalExecutions: 47,
    },
    {
      agentType: 'impact_analyzer',
      agentName: 'Impact Analyzer',
      model: {
        id: 'claude-sonnet-4-5-20250929',
        name: 'Claude Sonnet 4',
        provider: 'anthropic',
        version: '4.5',
        contextWindow: 200000,
        costPer1kInput: 0.003,
        costPer1kOutput: 0.015,
      },
      status: 'connected',
      lastUsed: '2024-01-19T16:30:00Z',
      totalExecutions: 23,
    },
    {
      agentType: 'spec_generator',
      agentName: 'Spec Generator',
      model: {
        id: 'claude-opus-4-20250514',
        name: 'Claude Opus 4',
        provider: 'anthropic',
        version: '4.0',
        contextWindow: 200000,
        costPer1kInput: 0.015,
        costPer1kOutput: 0.075,
      },
      status: 'connected',
      lastUsed: '2024-01-18T11:00:00Z',
      totalExecutions: 12,
    },
    {
      agentType: 'code_generator',
      agentName: 'Code Generator',
      model: {
        id: 'claude-sonnet-4-5-20250929',
        name: 'Claude Sonnet 4',
        provider: 'anthropic',
        version: '4.5',
        contextWindow: 200000,
        costPer1kInput: 0.003,
        costPer1kOutput: 0.015,
      },
      status: 'connected',
      lastUsed: '2024-01-17T09:15:00Z',
      totalExecutions: 8,
    },
  ],
  apiKeys: [
    {
      provider: 'anthropic',
      providerName: 'Anthropic',
      status: 'valid',
      maskedKey: '████████████████...7x4K',
      lastTested: '2024-01-20T10:00:00Z',
    },
    {
      provider: 'openai',
      providerName: 'OpenAI',
      status: 'not_configured',
    },
    {
      provider: 'google',
      providerName: 'Google AI',
      status: 'not_configured',
    },
  ],
  limits: {
    wipLimit: 3,
    maxUploadSizeMb: 10,
    dailyQuota: 'unlimited',
    concurrentAgents: 5,
    maxTokensPerRequest: 100000,
  },
  platform: {
    name: 'Entropy AI',
    version: '1.0.0-beta',
    environment: 'production',
    apiEndpoint: 'https://api.entropy.ai',
    documentationUrl: 'https://docs.entropy.ai',
    supportUrl: 'https://support.entropy.ai',
    changelogUrl: 'https://changelog.entropy.ai',
  },
};

export const settingsHandlers = [
  // Get all settings
  http.get('/api/v1/settings', async () => {
    await delay(400);
    return HttpResponse.json(mockSettings);
  }),

  // Test API key
  http.post('/api/v1/settings/test-api-key', async ({ request }) => {
    await delay(800); // Simulate network latency

    const body = (await request.json()) as { provider: string };
    const provider = body.provider;

    // Mock responses based on provider
    if (provider === 'anthropic') {
      return HttpResponse.json({
        provider: 'anthropic',
        success: true,
        message: 'Connection successful',
        latencyMs: 245,
      });
    } else if (provider === 'openai') {
      return HttpResponse.json({
        provider: 'openai',
        success: false,
        message: 'API key not configured',
      });
    } else {
      return HttpResponse.json({
        provider: provider,
        success: false,
        message: 'API key not configured',
      });
    }
  }),

  // Update project description
  http.patch('/api/v1/settings/project', async ({ request }) => {
    await delay(300);

    const body = (await request.json()) as { description: string };

    // Update mock data
    mockSettings.project.description = body.description;
    mockSettings.project.updatedAt = new Date().toISOString();

    return HttpResponse.json({
      success: true,
      project: mockSettings.project,
    });
  }),
];
