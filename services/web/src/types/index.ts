// User types
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
}

// Project types
export interface Project {
  id: string;
  name: string;
  status: 'active' | 'archived';
}

// Feature types
export interface Feature {
  id: string;
  requirementId: string;
  title: string;
  description: string;
  status: 'draft' | 'pending' | 'ready' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  readinessScore: number;
  priorityScore: number;
  clarifications?: Clarification[];
  themes?: string[];
  acceptanceCriteria?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Clarification {
  id: string;
  question: string;
  status: 'pending' | 'answered';
  answer?: string;
  createdAt: string;
  answeredAt?: string;
}

// Upload types
export interface Upload {
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

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface FeatureStats {
  total: number;
  ready: number;
  inProgress: number;
  needsAttention: number;
  pending: number;
}
