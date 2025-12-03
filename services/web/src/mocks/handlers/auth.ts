import { http, HttpResponse } from 'msw';
import type { User } from '@/types';

// Mock user data
const mockUser: User = {
  id: 'user-001',
  username: 'demo@entropy.app',
  email: 'demo@entropy.app',
  role: 'admin',
};

export const authHandlers = [
  // Login
  http.post('/api/v1/auth/login', async ({ request }) => {
    const body = (await request.json()) as { username: string; password: string };

    // Mock valid credentials
    if (body.username === 'demo@entropy.app' && body.password === 'demo123') {
      return HttpResponse.json({
        user: mockUser,
        token: 'mock-jwt-token-12345',
      });
    }

    return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }),

  // Get current user
  http.get('/api/v1/auth/me', ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.includes('mock-jwt-token')) {
      return HttpResponse.json(mockUser);
    }
    return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }),

  // Logout
  http.post('/api/v1/auth/logout', () => {
    return HttpResponse.json({ success: true });
  }),
];
