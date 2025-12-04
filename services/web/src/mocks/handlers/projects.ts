import { http, HttpResponse } from 'msw';
import type { Project } from '@/types';

const mockProjects: Project[] = [
  { id: 'proj-001', name: 'Project Alpha', status: 'active' },
  { id: 'proj-002', name: 'Project Beta', status: 'active' },
  { id: 'proj-003', name: 'Project Gamma', status: 'archived' },
];

export const projectHandlers = [
  // Get all projects
  http.get('/api/v1/projects', () => {
    return HttpResponse.json(mockProjects);
  }),

  // Get single project
  http.get('/api/v1/projects/:id', ({ params }) => {
    const project = mockProjects.find((p) => p.id === params.id);
    if (project) {
      return HttpResponse.json(project);
    }
    return HttpResponse.json({ error: 'Project not found' }, { status: 404 });
  }),
];
