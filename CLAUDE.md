# Entropy Platform - Claude Code Context

## Project Overview

Entropy is an AI-powered requirements decomposition and backlog management platform. It helps teams break down complex requirements into actionable features using multiple AI model providers with automatic fallback chains.

## Tech Stack

### Backend

- **Language**: TypeScript (strict mode, ES2022 target)
- **Package Manager**: pnpm 9+ with workspaces
- **Runtime**: Node.js 20 LTS
- **Testing**: Vitest (70% coverage threshold)
- **Linting**: ESLint + Prettier
- **Database**: PostgreSQL 15 with pgvector
- **Cache**: Redis 7
- **Job Queue**: BullMQ for background task processing
- **Cloud**: AWS (ECS Fargate, RDS, S3, ElastiCache)
- **IaC**: Terraform 1.6+

### Frontend

- **Framework**: React 18 with Vite 5
- **Routing**: React Router DOM v6
- **State Management**: Zustand v5
- **Data Fetching**: TanStack React Query v5
- **Forms**: React Hook Form v7
- **Styling**: TailwindCSS v3
- **UI Components**: Headless UI, Lucide React icons
- **HTTP Client**: Axios
- **Development Mocking**: MSW (Mock Service Worker) v2

## Directory Structure

```
sherpaAI/
├── packages/
│   ├── shared/             # @entropy/shared - Types, utils, constants
│   │   └── src/
│   │       ├── types/      # Core type definitions
│   │       ├── services/   # Shared services (text-extraction, readiness, decomposition-storage)
│   │       ├── cache/      # Caching utilities
│   │       ├── constants/  # Shared constants
│   │       ├── database/   # DB utilities
│   │       ├── storage/    # S3/storage abstractions
│   │       └── utils/      # Helper functions
│   ├── adapters/           # @entropy/adapters - Model adapters
│   │   └── src/
│   │       ├── anthropic.ts  # Claude models
│   │       ├── openai.ts     # GPT models
│   │       ├── google.ts     # Gemini models
│   │       ├── fallback.ts   # Automatic failover
│   │       ├── registry.ts   # Model registry
│   │       └── factory.ts    # Adapter factory
│   ├── agents/             # @entropy/agents - Agent framework
│   │   └── src/
│   │       ├── agents/       # Agent implementations
│   │       │   ├── classifier.agent.ts
│   │       │   └── decomposer.agent.ts
│   │       ├── base-agent.ts
│   │       ├── prompt-engine.ts
│   │       ├── validator.ts
│   │       ├── quality.ts
│   │       ├── execution-logger.ts
│   │       └── plugin-registry.ts
│   └── config/             # @entropy/config - Configuration
│       └── src/
│           ├── env.ts
│           ├── model-config.ts
│           └── model-registry.json
├── services/
│   ├── api/                # Express REST API
│   │   └── src/
│   │       ├── index.ts
│   │       ├── routes/     # API route handlers
│   │       │   ├── backlog.ts
│   │       │   ├── features.ts
│   │       │   ├── health.ts
│   │       │   ├── intake.ts
│   │       │   ├── questions.ts
│   │       │   ├── requirements.ts
│   │       │   ├── settings.ts
│   │       │   └── test-harness.ts
│   │       └── middleware/
│   ├── orchestrator/       # Background workers (BullMQ)
│   │   └── src/
│   │       ├── decomposition-orchestrator.ts
│   │       └── workers/
│   │           └── decomposition.worker.ts
│   └── web/                # React frontend (Vite)
│       └── src/
│           ├── pages/          # Page components
│           │   ├── Login.tsx
│           │   ├── Dashboard.tsx
│           │   ├── IntakeHub.tsx
│           │   ├── Backlog.tsx
│           │   ├── DecompositionPage.tsx
│           │   ├── HealthDashboard.tsx
│           │   ├── Settings.tsx
│           │   └── TestHarness.tsx
│           ├── features/       # Feature modules
│           │   ├── auth/       # Authentication
│           │   ├── intake/     # Document intake
│           │   ├── decomposition/  # Decomposition views
│           │   ├── feature-detail/ # Feature detail modal
│           │   ├── backlog/    # Backlog management
│           │   └── settings/   # Settings configuration
│           ├── components/     # Shared components
│           │   ├── layout/     # AppLayout, Header, Sidebar
│           │   ├── ui/         # Button, Input, Dropdown, etc.
│           │   └── test-harness/
│           ├── stores/         # Zustand state stores
│           ├── hooks/          # Custom React hooks
│           ├── mocks/          # MSW mock handlers
│           ├── lib/            # Utilities/helpers
│           └── types/          # Type definitions
├── infrastructure/
│   ├── terraform/          # AWS IaC
│   │   ├── environments/
│   │   ├── modules/
│   │   └── shared/
│   └── docker/
│       ├── Dockerfile.api
│       ├── Dockerfile.orchestrator
│       ├── Dockerfile.web
│       └── docker-compose.dev.yml
├── database/
│   └── migrations/         # SQL migrations
│       ├── 001_model_providers.sql
│       ├── 002_agent_configurations.sql
│       └── 003_core_entities.sql
└── .github/workflows/      # CI/CD pipelines
    ├── ci.yml
    └── deploy-staging.yml
```

## Quick Commands

```bash
# Install dependencies
pnpm install

# Start development (all services)
pnpm dev

# Run tests
pnpm test

# Run tests with coverage (70% threshold)
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch

# Lint code
pnpm lint
pnpm lint:fix

# Format code
pnpm format
pnpm format:check

# Type check all packages
pnpm typecheck

# Build all packages
pnpm build

# Clean all build artifacts
pnpm clean

# Database
make db:up        # Start PostgreSQL and Redis
make db:down      # Stop database services
pnpm db:migrate   # Run migrations
pnpm db:seed      # Seed database

# Docker
pnpm docker:up    # Start all services in Docker
pnpm docker:down  # Stop Docker services
pnpm docker:build # Build Docker images

# Makefile shortcuts
make install      # Install dependencies
make setup        # Full setup (install + db:up)
make test-coverage # Run tests with coverage
make lint-fix     # Fix linting issues
make format       # Format code
make typecheck    # Type check all packages

# Frontend development
cd services/web && pnpm dev  # Start web dev server
cd services/web && pnpm build # Build for production
```

## Package Aliases

Import packages using these aliases:

- `@entropy/shared` - Shared types, utilities, services
- `@entropy/adapters` - Model adapter implementations
- `@entropy/agents` - Agent framework and implementations
- `@entropy/config` - Configuration management

## Core Concepts

### Model Adapters (F-001)

Located in `packages/adapters/`. Provides a unified interface for AI providers:

```typescript
interface ModelAdapter {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  stream(request: CompletionRequest): AsyncIterable<StreamChunk>;
  countTokens(text: string): number;
  estimateCost(tokens: TokenUsage): number;
  healthCheck(): Promise<boolean>;
}
```

**Supported Providers:**

- **Anthropic**: Claude Sonnet 4.5 (recommended), Claude Opus 4.5, Claude 3.5 Sonnet, Claude 3 Haiku
- **OpenAI**: GPT-4o (recommended), GPT-4o Mini, GPT-4 Turbo
- **Google**: Gemini 1.5 Pro (recommended), Gemini 1.5 Flash

**Features:**

- Automatic fallback chains with circuit breaker pattern
- Hot-swap configuration without restarts
- Cost tracking and token counting
- Rate limiting per provider

### Agent Framework (F-002)

Located in `packages/agents/`. Base classes and utilities for AI agents:

- `BaseAgent` - Abstract class with lifecycle hooks (onBeforeExecute, onAfterExecute, onError)
- `PromptEngine` - Template rendering with variable substitution
- `OutputValidator` - JSON Schema validation for agent outputs
- `QualityScorer` - Output quality metrics (completeness, consistency, confidence)
- `ExecutionLogger` - Audit trail for all agent executions
- `PluginRegistry` - Pre/post processors for extensibility

**Implemented Agents:**

- `ClassifierAgent` - Categorizes requirements (new_feature, enhancement, epic, bug_fix)
- `DecomposerAgent` - Breaks requirements into themes, atomic requirements, and features

### Shared Services

Located in `packages/shared/src/services/`:

- `TextExtractionService` - Extracts text from PDF, DOCX, TXT, MD files
- `ReadinessService` - Calculates feature readiness scores
- `DecompositionStorageService` - Persists decomposition results

### API Routes

Located in `services/api/src/routes/`:

| Route                  | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `/health`              | Service health, readiness, liveness probes               |
| `/api/v1/requirements` | Upload, retrieve, decompose requirements                 |
| `/api/v1/features`     | CRUD operations for features                             |
| `/api/v1/backlog`      | Backlog views (now-playing, ready-soon, needs-attention) |
| `/api/v1/questions`    | Clarification questions management                       |
| `/api/v1/intake`       | Document intake processing                               |
| `/api/v1/settings`     | Model and configuration settings                         |
| `/api/test-harness`    | Testing utilities (non-production)                       |

### Orchestrator Service

Located in `services/orchestrator/`. Background job processing using BullMQ:

- `DecompositionOrchestrator` - Manages decomposition job lifecycle
- `decomposition.worker.ts` - Processes decomposition jobs asynchronously

**Job Queue Features:**

- Redis-backed persistent queues
- Automatic retry with exponential backoff
- Job progress tracking
- Concurrency control

### Web Frontend Architecture

Located in `services/web/src/`. Feature-based React application:

**Pages:**

| Page               | Description                                    |
| ------------------ | ---------------------------------------------- |
| `Login`            | Authentication page                            |
| `Dashboard`        | Main dashboard overview                        |
| `IntakeHub`        | Document upload and intake processing          |
| `Backlog`          | Feature backlog management view                |
| `DecompositionPage`| Decomposition results display                  |
| `HealthDashboard`  | Service health monitoring                      |
| `Settings`         | Configuration and model settings               |
| `TestHarness`      | Testing utilities (development only)           |

**Feature Modules:**

- `auth/` - Authentication with ProtectedRoute, LoginForm
- `intake/` - Document upload and processing components
- `decomposition/` - Decomposition result viewers
- `feature-detail/` - Multi-tab feature editor (Overview, Requirements, Questions, History)
- `backlog/` - Backlog list and management components
- `settings/` - Project settings, model config, API key management

**State Management (Zustand):**

- `authStore` - Authentication state and user session
- `uiStore` - UI state (sidebar, modals, themes)

**Data Fetching (React Query):**

- Automatic caching and background refetch
- Optimistic updates for mutations
- Polling with `usePolling` hook

**Mock Service Worker (MSW):**

Development mocking for API endpoints:

- `handlers/auth.ts` - Authentication mocks
- `handlers/intake.ts` - Intake API mocks
- `handlers/decomposition.ts` - Decomposition mocks
- `handlers/features.ts` - Feature CRUD mocks
- `handlers/settings.ts` - Settings API mocks

### Shared Utilities

Located in `packages/shared/src/utils/`:

- `logger.ts` - Structured logging utility
- `retry.ts` - Retry logic with exponential backoff
- `validation.ts` - JSON Schema validation helpers
- `s3-keys.ts` - S3 key generation and manipulation

## Key Types

### Requirement Lifecycle

```
uploaded -> extracting -> extracted -> classifying -> classified -> decomposing -> decomposed
                                                                              └-> failed
```

### Feature Status

```
draft -> needs_clarification -> ready -> in_progress -> completed
                                    └-> blocked     └-> cancelled
```

### Requirement Types

- `new_feature` - Entirely new functionality
- `enhancement` - Improvement to existing feature
- `epic` - Large multi-feature initiative
- `bug_fix` - Defect correction

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Server
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://entropy:entropy@localhost:5432/entropy_dev
DATABASE_POOL_SIZE=10

# Redis
REDIS_URL=redis://localhost:6379

# Model API Keys (at least one required)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...

# Default Model
DEFAULT_MODEL_PROVIDER=anthropic
DEFAULT_MODEL_ID=claude-sonnet-4-5-20250929

# AWS (for staging/production)
AWS_REGION=us-east-1
S3_BUCKET_UPLOADS=entropy-staging-uploads
S3_BUCKET_ARTIFACTS=entropy-staging-artifacts
S3_BUCKET_PROMPTS=entropy-staging-prompts

# Feature Flags
ENABLE_HOT_RELOAD=true
ENABLE_FALLBACK_CHAIN=true

# Frontend (services/web)
VITE_API_URL=http://localhost:3000
```

## Testing

Tests are co-located with source files (`*.test.ts`). Uses Vitest with:

- Global test functions enabled
- Node environment
- V8 coverage provider
- 70% coverage threshold for branches, functions, lines, statements

```bash
pnpm test              # Run all tests
pnpm test:coverage     # With coverage report
pnpm test:watch        # Watch mode

# Run specific test file
pnpm test packages/agents/src/base-agent.test.ts
```

## Code Style

### TypeScript

- Strict mode enabled
- ES2022 target with ESNext modules
- `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns` enabled
- `noUncheckedIndexedAccess` for safer array access

### ESLint Rules

- No unused variables (except those prefixed with `_`)
- Import ordering: builtin > external > internal > parent > sibling > index
- No console.log (use console.warn/error or proper logging)
- Strict equality (`===`) required

### Prettier

- Single quotes
- 2-space indentation
- Trailing commas (ES5)
- 100 character line width
- LF line endings

## CI/CD

### CI Pipeline (`.github/workflows/ci.yml`)

Runs on every push/PR to main:

1. **Lint** - ESLint + Prettier check
2. **Type Check** - TypeScript compilation
3. **Test** - Vitest with coverage
4. **Build** - All packages compilation
5. **Docker Build** - API, Orchestrator, Web images

### CD Pipeline (`.github/workflows/deploy-staging.yml`)

Deploys to staging on merge to main.

## Notes for AI Assistants

1. **No GUI dependencies** - All scripts work in headless environments
2. **Environment variables** - Database and services connect via env vars, never hardcode
3. **Use npx** - Prefer `npx` for CLI tools instead of global installs
4. **Test before commit** - Run `pnpm test` and `pnpm typecheck` before committing
5. **Format code** - Run `pnpm format` to ensure consistent formatting
6. **Co-located tests** - Place tests next to source files as `*.test.ts`
7. **Use package aliases** - Import from `@entropy/shared`, not relative paths across packages
8. **Type-safe JSON** - Always validate JSON responses against schemas using the validator
9. **Error handling** - Use typed errors from `@entropy/shared/types/adapter` (AdapterError, RateLimitError, etc.)
10. **Model fallbacks** - Configure fallback chains in model-registry.json for resilience

## Common Patterns

### Creating a New Agent

```typescript
import { BaseAgent, AgentInput, AgentOutput } from '@entropy/agents';
import { AgentType } from '@entropy/shared/types';

export class MyAgent extends BaseAgent {
  async execute(input: AgentInput): Promise<AgentOutput> {
    // 1. Validate input
    // 2. Render prompt template
    // 3. Call model adapter
    // 4. Validate output schema
    // 5. Score quality
    // 6. Return structured output
  }
}
```

### Adding API Routes

```typescript
import { Router } from 'express';
const router = Router();

router.get('/endpoint', async (req, res) => {
  // Validate request
  // Process
  // Return JSON response
});

export default router;
```

### Working with Decomposition Results

```typescript
import { DecompositionStorageService } from '@entropy/shared/services';

const storage = new DecompositionStorageService();
const result = await storage.getByRequirementId(requirementId);
```
