import { http, HttpResponse } from 'msw';
import type { Upload } from '@/types';

interface ExtendedUpload extends Upload {
  progress?: number;
}

const mockUploads: ExtendedUpload[] = [
  {
    id: 'upload-001',
    filename: 'e-commerce-rfp.pdf',
    size: 2500000,
    status: 'processing',
    progress: 65,
    uploadedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: 'upload-002',
    filename: 'mobile-app-spec.docx',
    size: 1200000,
    status: 'complete',
    uploadedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    processedAt: new Date(Date.now() - 13 * 60 * 1000).toISOString(),
    requirementId: 'req-002',
    featureCount: 12,
  },
  {
    id: 'upload-003',
    filename: 'api-requirements.txt',
    size: 45000,
    status: 'complete',
    uploadedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    processedAt: new Date(Date.now() - 58 * 60 * 1000).toISOString(),
    requirementId: 'req-003',
    featureCount: 8,
  },
  {
    id: 'upload-004',
    filename: 'old-system-notes.md',
    size: 120000,
    status: 'error',
    uploadedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    error: 'Unable to extract text from document',
  },
];

// Helper to simulate processing progress
function simulateProcessing(upload: ExtendedUpload) {
  if (upload.status !== 'processing') return;

  const interval = setInterval(() => {
    if (upload.progress === undefined) {
      upload.progress = 0;
    }

    upload.progress += Math.floor(Math.random() * 15) + 5;

    if (upload.progress >= 100) {
      upload.progress = 100;
      upload.status = 'complete';
      upload.processedAt = new Date().toISOString();
      upload.requirementId = `req-${upload.id}`;
      upload.featureCount = Math.floor(Math.random() * 15) + 5;
      clearInterval(interval);
    }
  }, 2000);
}

// Start processing simulation for initial mock data
mockUploads.forEach((upload) => {
  if (upload.status === 'processing') {
    simulateProcessing(upload);
  }
});

export const intakeHandlers = [
  // Get uploads
  http.get('/api/v1/intake/uploads', () => {
    return HttpResponse.json({ uploads: mockUploads });
  }),

  // Upload file
  http.post('/api/v1/intake/upload', async ({ request }) => {
    // Simulate upload delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    const newUpload: ExtendedUpload = {
      id: `upload-${Date.now()}`,
      filename: file?.name || 'uploaded-document.pdf',
      size: file?.size || 256000,
      status: 'processing',
      progress: 0,
      uploadedAt: new Date().toISOString(),
    };

    mockUploads.unshift(newUpload);

    // Start processing simulation
    simulateProcessing(newUpload);

    return HttpResponse.json({
      id: newUpload.id,
      filename: newUpload.filename,
      size: newUpload.size,
      status: newUpload.status,
      message: 'File uploaded successfully',
    });
  }),

  // Submit text (paste text feature)
  http.post('/api/v1/intake/submit-text', async ({ request }) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const body = (await request.json()) as { content: string };
    const contentPreview =
      body.content.substring(0, 30) + (body.content.length > 30 ? '...' : '');

    const newUpload: ExtendedUpload = {
      id: `upload-${Date.now()}`,
      filename: `pasted-text-${new Date().toISOString().slice(0, 10)}.txt`,
      size: new Blob([body.content]).size,
      status: 'processing',
      progress: 0,
      uploadedAt: new Date().toISOString(),
    };

    mockUploads.unshift(newUpload);

    // Start processing simulation
    simulateProcessing(newUpload);

    return HttpResponse.json({
      id: newUpload.id,
      filename: newUpload.filename,
      status: newUpload.status,
      message: `Text submitted successfully: "${contentPreview}"`,
    });
  }),

  // Delete upload
  http.delete('/api/v1/intake/uploads/:id', ({ params }) => {
    const index = mockUploads.findIndex((u) => u.id === params.id);
    if (index !== -1) {
      mockUploads.splice(index, 1);
      return HttpResponse.json({ success: true });
    }
    return HttpResponse.json({ error: 'Upload not found' }, { status: 404 });
  }),

  // Reprocess upload
  http.post('/api/v1/intake/uploads/:id/reprocess', ({ params }) => {
    const upload = mockUploads.find((u) => u.id === params.id);
    if (upload) {
      upload.status = 'processing';
      upload.progress = 0;
      upload.error = undefined;
      upload.processedAt = undefined;
      upload.featureCount = undefined;

      // Start processing simulation
      simulateProcessing(upload);

      return HttpResponse.json({ success: true, message: 'Reprocessing started' });
    }
    return HttpResponse.json({ error: 'Upload not found' }, { status: 404 });
  }),
];
