import clsx from 'clsx';
import { Upload, File, CheckCircle, AlertCircle } from 'lucide-react';
import { useState, useCallback } from 'react';

export default function IntakeHub() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFiles = (files: File[]) => {
    const newUploads: UploadItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      status: 'uploading',
    }));

    setUploads((prev) => [...newUploads, ...prev]);

    // Simulate upload
    newUploads.forEach((upload) => {
      setTimeout(() => {
        setUploads((prev) =>
          prev.map((u) => (u.id === upload.id ? { ...u, status: 'complete' } : u))
        );
      }, 1500);
    });
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Intake Hub</h1>

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
          isDragging ? 'border-entropy-500 bg-entropy-50' : 'border-gray-300 hover:border-gray-400'
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
          onChange={(e) => {
            if (e.target.files) {
              handleFiles(Array.from(e.target.files));
            }
          }}
        />
        <label
          htmlFor="file-upload"
          className="bg-entropy-600 hover:bg-entropy-700 inline-flex cursor-pointer items-center rounded-lg px-4 py-2 text-white transition-colors"
        >
          Browse Files
        </label>
      </div>

      {/* Recent Uploads */}
      {uploads.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">Recent Uploads</h2>
          <div className="space-y-2">
            {uploads.map((upload) => (
              <div
                key={upload.id}
                className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4"
              >
                <File className="h-8 w-8 text-gray-400" />
                <div className="flex-1">
                  <p className="font-medium">{upload.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(upload.size)}</p>
                </div>
                {upload.status === 'uploading' && (
                  <div className="border-entropy-500 h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
                )}
                {upload.status === 'complete' && <CheckCircle className="h-6 w-6 text-green-500" />}
                {upload.status === 'error' && <AlertCircle className="h-6 w-6 text-red-500" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface UploadItem {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'complete' | 'error';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
