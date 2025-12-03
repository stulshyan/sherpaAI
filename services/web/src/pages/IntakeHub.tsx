import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import clsx from 'clsx';
import { Upload, File, CheckCircle, AlertCircle, RefreshCw, Trash2, Clock, Loader2 } from 'lucide-react';
import { useState, useCallback } from 'react';

const api = axios.create({
  baseURL: '/api/v1/intake',
});

interface UploadResponse {
  id: string;
  filename: string;
  size: number;
  status: string;
  message: string;
}

interface UploadRecord {
  id: string;
  filename: string;
  size: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  uploadedAt: string;
  processedAt?: string;
  requirementId?: string;
  featureCount?: number;
  error?: string;
}

export default function IntakeHub() {
  const [isDragging, setIsDragging] = useState(false);
  const [localUploads, setLocalUploads] = useState<Map<string, { name: string; size: number }>>(
    new Map()
  );
  const queryClient = useQueryClient();

  // Fetch existing uploads
  const { data: uploadsData, isLoading: uploadsLoading } = useQuery<{ uploads: UploadRecord[] }>({
    queryKey: ['uploads'],
    queryFn: async () => {
      const response = await api.get('/uploads');
      return response.data;
    },
    refetchInterval: 5000, // Poll for status updates
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post<UploadResponse>('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploads'] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (uploadId: string) => {
      await api.delete(`/uploads/${uploadId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploads'] });
    },
  });

  // Reprocess mutation
  const reprocessMutation = useMutation({
    mutationFn: async (uploadId: string) => {
      const response = await api.post(`/uploads/${uploadId}/reprocess`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploads'] });
    },
  });

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    },
    [uploadMutation]
  );

  const handleFiles = async (files: File[]) => {
    for (const file of files) {
      // Add to local state for immediate feedback
      const tempId = crypto.randomUUID();
      setLocalUploads((prev) => new Map(prev).set(tempId, { name: file.name, size: file.size }));

      try {
        await uploadMutation.mutateAsync(file);
      } catch (error) {
        console.error('Upload failed:', error);
      } finally {
        // Remove from local state
        setLocalUploads((prev) => {
          const next = new Map(prev);
          next.delete(tempId);
          return next;
        });
      }
    }
  };

  const handleDelete = (uploadId: string) => {
    if (confirm('Are you sure you want to delete this upload?')) {
      deleteMutation.mutate(uploadId);
    }
  };

  const handleReprocess = (uploadId: string) => {
    reprocessMutation.mutate(uploadId);
  };

  const uploads = uploadsData?.uploads || [];
  const pendingUploads = Array.from(localUploads.entries());

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Intake Hub</h1>
        <p className="text-gray-500">Upload requirement documents for decomposition</p>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={clsx(
          'rounded-lg border-2 border-dashed p-12 text-center transition-colors',
          isDragging ? 'border-entropy-500 bg-entropy-50' : 'border-gray-300 hover:border-gray-400',
          uploadMutation.isPending && 'opacity-50 pointer-events-none'
        )}
      >
        <Upload className="mx-auto mb-4 h-12 w-12 text-gray-400" />
        <p className="mb-2 text-lg font-medium">Drop requirement documents here</p>
        <p className="mb-4 text-sm text-gray-500">Supports PDF, DOCX, TXT, MD (max 10MB)</p>
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".pdf,.docx,.txt,.md"
          multiple
          disabled={uploadMutation.isPending}
          onChange={(e) => {
            if (e.target.files) {
              handleFiles(Array.from(e.target.files));
              e.target.value = ''; // Reset input
            }
          }}
        />
        <label
          htmlFor="file-upload"
          className={clsx(
            'inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-white transition-colors',
            uploadMutation.isPending
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-entropy-600 hover:bg-entropy-700'
          )}
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            'Browse Files'
          )}
        </label>
      </div>

      {/* Upload Error */}
      {uploadMutation.isError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-700">
            Upload failed:{' '}
            {uploadMutation.error instanceof Error
              ? uploadMutation.error.message
              : 'Unknown error'}
          </p>
        </div>
      )}

      {/* Recent Uploads */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Uploads</h2>
          {uploadsLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          )}
        </div>

        {/* Pending uploads (being uploaded) */}
        {pendingUploads.length > 0 && (
          <div className="mb-4 space-y-2">
            {pendingUploads.map(([id, { name, size }]) => (
              <div
                key={id}
                className="flex items-center gap-4 rounded-lg border border-entropy-200 bg-entropy-50 p-4"
              >
                <File className="h-8 w-8 text-entropy-500" />
                <div className="flex-1">
                  <p className="font-medium">{name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(size)}</p>
                </div>
                <div className="flex items-center gap-2 text-entropy-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Uploading...</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Server uploads */}
        {uploads.length > 0 ? (
          <div className="space-y-2">
            {uploads.map((upload) => (
              <UploadCard
                key={upload.id}
                upload={upload}
                onDelete={() => handleDelete(upload.id)}
                onReprocess={() => handleReprocess(upload.id)}
                isDeleting={deleteMutation.isPending}
                isReprocessing={reprocessMutation.isPending}
              />
            ))}
          </div>
        ) : (
          !uploadsLoading &&
          pendingUploads.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
              <p className="text-gray-500">No uploads yet</p>
              <p className="mt-1 text-sm text-gray-400">
                Upload a requirement document to get started
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

interface UploadCardProps {
  upload: UploadRecord;
  onDelete: () => void;
  onReprocess: () => void;
  isDeleting: boolean;
  isReprocessing: boolean;
}

function UploadCard({
  upload,
  onDelete,
  onReprocess,
  isDeleting,
  isReprocessing,
}: UploadCardProps) {
  const statusConfig: Record<
    string,
    { icon: React.ElementType; color: string; label: string; bgColor: string }
  > = {
    uploading: {
      icon: Loader2,
      color: 'text-blue-500',
      label: 'Uploading',
      bgColor: 'bg-blue-50',
    },
    processing: {
      icon: Clock,
      color: 'text-yellow-500',
      label: 'Processing',
      bgColor: 'bg-yellow-50',
    },
    complete: {
      icon: CheckCircle,
      color: 'text-green-500',
      label: 'Complete',
      bgColor: 'bg-green-50',
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-500',
      label: 'Error',
      bgColor: 'bg-red-50',
    },
  };

  const status = statusConfig[upload.status] || statusConfig.error;
  const StatusIcon = status.icon;

  return (
    <div
      className={clsx(
        'flex items-center gap-4 rounded-lg border p-4',
        upload.status === 'error' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
      )}
    >
      <File className="h-8 w-8 text-gray-400" />
      <div className="flex-1">
        <p className="font-medium">{upload.filename}</p>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{formatFileSize(upload.size)}</span>
          <span>•</span>
          <span>{new Date(upload.uploadedAt).toLocaleDateString()}</span>
          {upload.featureCount !== undefined && (
            <>
              <span>•</span>
              <span className="text-green-600">{upload.featureCount} features extracted</span>
            </>
          )}
        </div>
        {upload.error && <p className="mt-1 text-sm text-red-600">{upload.error}</p>}
      </div>

      <div className="flex items-center gap-2">
        {/* Status badge */}
        <div className={clsx('flex items-center gap-1 rounded-full px-2 py-1', status.bgColor)}>
          <StatusIcon
            className={clsx('h-4 w-4', status.color, {
              'animate-spin': upload.status === 'uploading' || upload.status === 'processing',
            })}
          />
          <span className={clsx('text-xs font-medium', status.color)}>{status.label}</span>
        </div>

        {/* Actions */}
        {upload.status === 'error' && (
          <button
            onClick={onReprocess}
            disabled={isReprocessing}
            className="rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Retry"
          >
            <RefreshCw className={clsx('h-4 w-4', isReprocessing && 'animate-spin')} />
          </button>
        )}
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
