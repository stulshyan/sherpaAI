import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState, useCallback } from 'react';
import {
  FileValidationResult,
  UploadProgress,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
} from '../types';

const api = axios.create({
  baseURL: '/api/v1/intake',
});

export function validateFile(file: File): FileValidationResult {
  // Check file type by extension
  const extension = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File too large (${sizeMB}MB). Maximum size is 10MB.`,
    };
  }

  return { valid: true };
}

interface UploadResponse {
  id: string;
  filename: string;
  size: number;
  status: string;
  message: string;
}

export function useFileUpload() {
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      // Validate file first
      const validation = validateFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post<UploadResponse>('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total || file.size;
          setProgress({
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
      setProgress(null);
      setValidationError(null);
    },
    onError: (error) => {
      setProgress(null);
      if (error instanceof Error) {
        setValidationError(error.message);
      }
    },
  });

  const upload = useCallback(
    (file: File) => {
      setValidationError(null);
      const validation = validateFile(file);
      if (!validation.valid) {
        setValidationError(validation.error || 'Invalid file');
        return;
      }
      mutation.mutate(file);
    },
    [mutation]
  );

  const reset = useCallback(() => {
    setProgress(null);
    setValidationError(null);
    mutation.reset();
  }, [mutation]);

  return {
    upload,
    isUploading: mutation.isPending,
    progress,
    error: validationError || (mutation.error instanceof Error ? mutation.error.message : null),
    reset,
  };
}

interface TextSubmitResponse {
  id: string;
  status: string;
  message: string;
}

export function useTextSubmit() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await api.post<TextSubmitResponse>('/submit-text', {
        content: text,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploads'] });
    },
  });

  return {
    submit: mutation.mutate,
    isSubmitting: mutation.isPending,
    error: mutation.error instanceof Error ? mutation.error.message : null,
    reset: mutation.reset,
  };
}
