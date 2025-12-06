import { http, HttpResponse } from 'msw';

// Mock healthy system response
const mockHealthResponse = {
  status: 'healthy' as const,
  timestamp: new Date().toISOString(),
  services: {
    api: {
      status: 'up' as const,
      latencyMs: 12,
    },
    database: {
      status: 'up' as const,
      latencyMs: 8,
      tables: [
        { name: 'public.requirements', rowCount: 156 },
        { name: 'public.features', rowCount: 892 },
        { name: 'public.decompositions', rowCount: 423 },
        { name: 'public.questions', rowCount: 234 },
        { name: 'public.projects', rowCount: 12 },
        { name: 'public.users', rowCount: 45 },
      ],
      poolStats: {
        totalCount: 10,
        idleCount: 8,
        waitingCount: 0,
      },
    },
    storage: {
      status: 'up' as const,
      bucket: 'entropy-dev-uploads',
      objectCount: 342,
      totalSizeBytes: 156789012,
      recentObjects: [
        {
          key: 'uploads/req-001/document.pdf',
          size: 245678,
          lastModified: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          key: 'uploads/req-002/requirements.docx',
          size: 89012,
          lastModified: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          key: 'artifacts/decomp-001/output.json',
          size: 12345,
          lastModified: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
    },
    cache: {
      status: 'up' as const,
      latencyMs: 2,
      memoryUsedMb: 45.6,
      keyCount: 1234,
      hitRate: 0.92,
    },
  },
  adapters: [
    {
      id: 'anthropic-claude-sonnet',
      provider: 'anthropic',
      model: 'claude-sonnet-4-5-20250929',
      healthy: true,
      latencyMs: 245,
    },
    {
      id: 'anthropic-claude-opus',
      provider: 'anthropic',
      model: 'claude-opus-4-5-20251101',
      healthy: true,
      latencyMs: 312,
    },
    {
      id: 'openai-gpt4o',
      provider: 'openai',
      model: 'gpt-4o',
      healthy: true,
      latencyMs: 198,
    },
    {
      id: 'google-gemini',
      provider: 'google',
      model: 'gemini-1.5-pro',
      healthy: true,
      latencyMs: 267,
    },
  ],
};

export const healthHandlers = [
  // Basic health check
  http.get('/api/v1/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        api: { status: 'up' },
      },
    });
  }),

  // Detailed health check
  http.get('/api/v1/health/detailed', () => {
    // Return fresh timestamp on each request
    return HttpResponse.json({
      ...mockHealthResponse,
      timestamp: new Date().toISOString(),
    });
  }),

  // Readiness check
  http.get('/api/v1/health/ready', () => {
    return HttpResponse.json({ ready: true });
  }),

  // Liveness check
  http.get('/api/v1/health/live', () => {
    return HttpResponse.json({ alive: true });
  }),

  // Database health check
  http.get('/api/v1/health/db', () => {
    return HttpResponse.json({
      status: 'up',
      latencyMs: 8,
      tables: mockHealthResponse.services.database?.tables,
      poolStats: mockHealthResponse.services.database?.poolStats,
    });
  }),

  // Storage health check
  http.get('/api/v1/health/storage', () => {
    return HttpResponse.json(mockHealthResponse.services.storage);
  }),

  // Cache health check
  http.get('/api/v1/health/cache', () => {
    return HttpResponse.json({
      status: 'up',
      latencyMs: 2,
      info: {
        redisVersion: '7.2.3',
        uptimeSeconds: 86400,
        connectedClients: 5,
        usedMemoryHuman: '45.6M',
        totalSystemMemoryHuman: '8.0G',
      },
    });
  }),
];
