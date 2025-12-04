import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import clsx from 'clsx';
import {
  Upload,
  File,
  FileText,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  Clock,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import {
  validateFile,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  type UploadProgress,
} from '@/features/intake';
import { PasteTextModal } from '@/features/intake/components';

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
  progress?: number; // 0-100 for processing progress
  uploadedAt: string;
  processedAt?: string;
  requirementId?: string;
  featureCount?: number;
  error?: string;
}

export default function IntakeHub() {
  const [isDragging, setIsDragging] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [localUploads, setLocalUploads] = useState<Map<string, { name: string; size: number }>>(
    new Map()
  );
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch existing uploads with polling
  const { data: uploadsData, isLoading: uploadsLoading } = useQuery<{
    uploads: UploadRecord[];
  }>({
    queryKey: ['uploads'],
    queryFn: async () => {
      const response = await api.get('/uploads');
      return response.data;
    },
    refetchInterval: (query) => {
      // Poll every 5s if any upload is still processing
      const data = query.state.data;
      const hasProcessing = data?.uploads?.some(
        (r) => r.status === 'processing' || r.status === 'uploading'
      );
      return hasProcessing ? 5000 : false;
    },
  });

  // Upload mutation with progress tracking
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post<UploadResponse>('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total || file.size;
          setUploadProgress({
            loaded: progressEvent.loaded,
            total,
            percentage: Math.round((progressEvent.loaded / total) * 100),
          });
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploads'] });
      setUploadProgress(null);
    },
    onError: () => {
      setUploadProgress(null);
    },
  });

  // Text submit mutation
  const textSubmitMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await api.post('/submit-text', { content: text });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploads'] });
      setIsPasteModalOpen(false);
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setValidationError(null);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleFile = async (file: File) => {
    // Validate file first
    const validation = validateFile(file);
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid file');
      return;
    }

    setValidationError(null);

    // Add to local state for immediate feedback
    const tempId = crypto.randomUUID();
    setLocalUploads((prev) => new Map(prev).set(tempId, { name: file.name, size: file.size }));

    try {
      await uploadMutation.mutateAsync(file);
    } catch {
      // Error is handled by mutation
    } finally {
      // Remove from local state
      setLocalUploads((prev) => {
        const next = new Map(prev);
        next.delete(tempId);
        return next;
      });
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

  const handleUploadClick = (upload: UploadRecord) => {
    if (upload.status === 'complete' && upload.requirementId) {
      navigate(`/intake/${upload.requirementId}`);
    }
  };

  const uploads = uploadsData?.uploads || [];
  const pendingUploads = Array.from(localUploads.entries());

  return (
    <div className="mx-auto max-w-4xl">
      {/* Page Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <div className="bg-primary-100 dark:bg-primary-900 rounded-lg p-2">
            <Upload className="text-primary-600 dark:text-primary-400 h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Intake Hub</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400">Drop Anything, AI Handles the Rest</p>
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
          'rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 md:p-12',
          isDragging
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 scale-[1.02]'
            : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500',
          uploadMutation.isPending && 'pointer-events-none opacity-50'
        )}
      >
        <Upload
          className={clsx(
            'mx-auto mb-4 h-12 w-12 transition-colors',
            isDragging ? 'text-primary-500' : 'text-gray-400 dark:text-gray-500'
          )}
        />
        <p className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
          {isDragging ? 'Release to upload' : 'Drag & Drop Requirements Here'}
        </p>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Accepts: {ALLOWED_EXTENSIONS.join(', ').toUpperCase()} (Max{' '}
          {MAX_FILE_SIZE / (1024 * 1024)}MB)
        </p>

        {/* Mobile: Show "Tap to Upload" */}
        <p className="mb-4 text-sm text-gray-400 md:hidden dark:text-gray-500">
          Tap below to upload from your device
        </p>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept={ALLOWED_EXTENSIONS.join(',')}
            disabled={uploadMutation.isPending}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
                e.target.value = ''; // Reset input
              }
            }}
          />
          <Button
            variant="primary"
            size="lg"
            disabled={uploadMutation.isPending}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              'Browse Files'
            )}
          </Button>
          <Button
            variant="outline"
            size="lg"
            disabled={uploadMutation.isPending}
            onClick={() => setIsPasteModalOpen(true)}
            leftIcon={<FileText className="h-4 w-4" />}
          >
            Paste Text
          </Button>
        </div>
      </div>

      {/* Validation/Upload Error */}
      {(validationError || uploadMutation.isError) && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-red-700 dark:text-red-400">
              {validationError ||
                (uploadMutation.error instanceof Error
                  ? uploadMutation.error.message
                  : 'Upload failed. Please try again.')}
            </p>
          </div>
          <button
            onClick={() => {
              setValidationError(null);
              uploadMutation.reset();
            }}
            className="mt-2 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Upload Progress */}
      {uploadProgress && (
        <div className="border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/20 mt-4 rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <File className="text-primary-500 h-6 w-6" />
            <div className="flex-1">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Uploading...
                </span>
                <span className="text-primary-600 dark:text-primary-400 text-sm font-medium">
                  {uploadProgress.percentage}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="bg-primary-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress.percentage}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {formatFileSize(uploadProgress.loaded)} / {formatFileSize(uploadProgress.total)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Uploads */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Uploads</h2>
          {uploadsLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
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
                className="border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/20 flex items-center gap-4 rounded-lg border p-4"
              >
                <File className="text-primary-500 h-8 w-8" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{formatFileSize(size)}</p>
                </div>
                <div className="text-primary-600 dark:text-primary-400 flex items-center gap-2">
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
                onClick={() => handleUploadClick(upload)}
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
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-800/50">
              <Upload className="mx-auto mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
              <p className="font-medium text-gray-500 dark:text-gray-400">
                No requirements uploaded yet
              </p>
              <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
                Drop your first file above to get started
              </p>
            </div>
          )
        )}
      </div>

      {/* Paste Text Modal */}
      <PasteTextModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        onSubmit={(text) => textSubmitMutation.mutate(text)}
        isSubmitting={textSubmitMutation.isPending}
      />
    </div>
  );
}

interface UploadCardProps {
  upload: UploadRecord;
  onClick: () => void;
  onDelete: () => void;
  onReprocess: () => void;
  isDeleting: boolean;
  isReprocessing: boolean;
}

function UploadCard({
  upload,
  onClick,
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
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    processing: {
      icon: Clock,
      color: 'text-yellow-500',
      label: upload.progress ? `Processing (${upload.progress}%)` : 'Processing',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    },
    complete: {
      icon: CheckCircle,
      color: 'text-green-500',
      label: 'Completed',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-500',
      label: 'Failed',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
    },
  };

  const status = statusConfig[upload.status] || statusConfig.error;
  const StatusIcon = status.icon;
  const isClickable = upload.status === 'complete' && upload.requirementId;

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={clsx(
        'flex items-center gap-4 rounded-lg border p-4 transition-all',
        upload.status === 'error'
          ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
        isClickable &&
          'hover:border-primary-300 dark:hover:border-primary-600 cursor-pointer hover:shadow-md'
      )}
    >
      <File className="h-8 w-8 text-gray-400 dark:text-gray-500" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-gray-900 dark:text-white">{upload.filename}</p>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <span>{formatFileSize(upload.size)}</span>
          <span>•</span>
          <span>{formatRelativeTime(upload.uploadedAt)}</span>
          {upload.featureCount !== undefined && (
            <>
              <span>•</span>
              <span className="text-green-600 dark:text-green-400">
                {upload.featureCount} features extracted
              </span>
            </>
          )}
        </div>
        {upload.error && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{upload.error}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Processing progress bar */}
        {upload.status === 'processing' && upload.progress !== undefined && (
          <div className="mr-2 h-1.5 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
            <div
              className="h-full bg-yellow-500 transition-all duration-300"
              style={{ width: `${upload.progress}%` }}
            />
          </div>
        )}

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
            onClick={(e) => {
              e.stopPropagation();
              onReprocess();
            }}
            disabled={isReprocessing}
            className="rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            title="Retry"
          >
            <RefreshCw className={clsx('h-4 w-4', isReprocessing && 'animate-spin')} />
          </button>
        )}

        {isClickable && <ArrowRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={isDeleting}
          className="rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
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

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
