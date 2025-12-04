// Settings Types - S-053

export interface ProjectSettingsData {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ModelAssignment {
  agentType: AgentType;
  agentName: string;
  model: ModelInfo;
  status: ConnectionStatus;
  lastUsed?: string;
  totalExecutions?: number;
}

export type AgentType =
  | 'decomposer'
  | 'impact_analyzer'
  | 'spec_generator'
  | 'code_generator'
  | 'validator'
  | 'classifier';

export interface ModelInfo {
  id: string;
  name: string;
  provider: ModelProvider;
  version: string;
  contextWindow: number;
  costPer1kInput: number;
  costPer1kOutput: number;
}

export type ModelProvider = 'anthropic' | 'openai' | 'google' | 'azure';

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'not_configured';

export interface ApiKeyInfo {
  provider: ModelProvider;
  providerName: string;
  status: ApiKeyStatusType;
  maskedKey?: string;
  lastTested?: string;
  expiresAt?: string;
}

export type ApiKeyStatusType = 'valid' | 'invalid' | 'expired' | 'not_configured';

export interface ProcessingLimitsData {
  wipLimit: number;
  maxUploadSizeMb: number;
  dailyQuota: number | 'unlimited';
  concurrentAgents: number;
  maxTokensPerRequest: number;
}

export interface PlatformInfo {
  name: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  apiEndpoint: string;
  documentationUrl: string;
  supportUrl: string;
  changelogUrl: string;
}

export interface SettingsData {
  project: ProjectSettingsData;
  models: ModelAssignment[];
  apiKeys: ApiKeyInfo[];
  limits: ProcessingLimitsData;
  platform: PlatformInfo;
}

export interface ApiKeyTestResult {
  provider: ModelProvider;
  success: boolean;
  message: string;
  latencyMs?: number;
}

// Provider configuration for UI display
export const PROVIDER_CONFIG: Record<
  ModelProvider,
  { name: string; color: string; bgColor: string }
> = {
  anthropic: {
    name: 'Anthropic',
    color: '#D97757',
    bgColor: '#FEF3E8',
  },
  openai: {
    name: 'OpenAI',
    color: '#10A37F',
    bgColor: '#E6F7F1',
  },
  google: {
    name: 'Google AI',
    color: '#4285F4',
    bgColor: '#E8F0FE',
  },
  azure: {
    name: 'Azure OpenAI',
    color: '#0078D4',
    bgColor: '#E6F2FA',
  },
};

// Status colors for UI display
export const STATUS_CONFIG: Record<
  ConnectionStatus | ApiKeyStatusType,
  { bg: string; text: string; icon: string }
> = {
  connected: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    icon: '✅',
  },
  valid: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    icon: '✅',
  },
  disconnected: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    icon: '❌',
  },
  invalid: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    icon: '❌',
  },
  expired: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    icon: '❌',
  },
  not_configured: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
    icon: '⚠️',
  },
  error: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    icon: '❌',
  },
};

// Helper functions
export function getAgentDisplayName(agentType: AgentType): string {
  const names: Record<AgentType, string> = {
    decomposer: 'Decomposer Agent',
    impact_analyzer: 'Impact Analyzer',
    spec_generator: 'Spec Generator',
    code_generator: 'Code Generator',
    validator: 'Validator',
    classifier: 'Classifier',
  };
  return names[agentType] || agentType;
}

export function getStatusLabel(status: ConnectionStatus | ApiKeyStatusType): string {
  const labels: Record<ConnectionStatus | ApiKeyStatusType, string> = {
    connected: 'Connected',
    valid: 'Connected',
    disconnected: 'Disconnected',
    invalid: 'Invalid',
    expired: 'Expired',
    not_configured: 'Not Configured',
    error: 'Error',
  };
  return labels[status] || status;
}

export function formatContextWindow(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M tokens`;
  }
  return `${(tokens / 1000).toFixed(0)}K tokens`;
}

export function formatCost(costPer1k: number): string {
  const costPerMillion = costPer1k * 1000;
  return `$${costPerMillion.toFixed(2)} / 1M tokens`;
}
