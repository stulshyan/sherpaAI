import { useState, useCallback } from 'react';
import { Upload, File, CheckCircle, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

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
          prev.map((u) =>
            u.id === upload.id ? { ...u, status: 'complete' } : u
          )
        );
      }, 1500);
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Intake Hub</h1>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={clsx(
          'border-2 border-dashed rounded-lg p-12 text-center transition-colors',
          isDragging
            ? 'border-entropy-500 bg-entropy-50'
            : 'border-gray-300 hover:border-gray-400'
        )}
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p className="text-lg font-medium mb-2">
          Drop requirement documents here
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Supports PDF, DOCX, TXT, MD (max 10MB)
        </p>
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
          className="inline-flex items-center px-4 py-2 bg-entropy-600 text-white rounded-lg cursor-pointer hover:bg-entropy-700 transition-colors"
        >
          Browse Files
        </label>
      </div>

      {/* Recent Uploads */}
      {uploads.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Recent Uploads</h2>
          <div className="space-y-2">
            {uploads.map((upload) => (
              <div
                key={upload.id}
                className="flex items-center gap-4 bg-white rounded-lg border border-gray-200 p-4"
              >
                <File className="w-8 h-8 text-gray-400" />
                <div className="flex-1">
                  <p className="font-medium">{upload.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(upload.size)}
                  </p>
                </div>
                {upload.status === 'uploading' && (
                  <div className="w-6 h-6 border-2 border-entropy-500 border-t-transparent rounded-full animate-spin" />
                )}
                {upload.status === 'complete' && (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                )}
                {upload.status === 'error' && (
                  <AlertCircle className="w-6 h-6 text-red-500" />
                )}
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
