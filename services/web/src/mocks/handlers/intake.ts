import { http, HttpResponse } from 'msw';
import type { Upload } from '@/types';

const mockUploads: Upload[] = [
  {
    id: 'upload-001',
    filename: 'product-requirements.pdf',
    size: 1024000,
    status: 'complete',
    uploadedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    processedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 30000).toISOString(),
    requirementId: 'req-001',
    featureCount: 4,
  },
  {
    id: 'upload-002',
    filename: 'technical-spec.docx',
    size: 512000,
    status: 'processing',
    uploadedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'upload-003',
    filename: 'user-stories.md',
    size: 25600,
    status: 'error',
    uploadedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    error: 'Failed to extract text from document',
  },
];

export const intakeHandlers = [
  // Get uploads
  http.get('/api/v1/intake/uploads', () => {
    return HttpResponse.json({ uploads: mockUploads });
  }),

  // Upload file
  http.post('/api/v1/intake/upload', async () => {
    // Simulate upload delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const newUpload: Upload = {
      id: `upload-${Date.now()}`,
      filename: 'new-document.pdf',
      size: 256000,
      status: 'processing',
      uploadedAt: new Date().toISOString(),
    };

    mockUploads.unshift(newUpload);

    return HttpResponse.json({
      id: newUpload.id,
      filename: newUpload.filename,
      size: newUpload.size,
      status: newUpload.status,
      message: 'File uploaded successfully',
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
      upload.error = undefined;
      return HttpResponse.json({ success: true, message: 'Reprocessing started' });
    }
    return HttpResponse.json({ error: 'Upload not found' }, { status: 404 });
  }),
];
