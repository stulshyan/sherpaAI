// Common types used across the platform

export type UUID = string;

export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export type Status = 'pending' | 'processing' | 'completed' | 'failed';

export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  services: Record<string, ServiceHealth>;
}

export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  message?: string;
}
