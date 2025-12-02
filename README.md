# Entropy Platform

AI-powered requirements decomposition and backlog management platform.

## Overview

Entropy helps teams break down complex requirements into actionable features using multiple AI model providers. It provides:

- **Model-Agnostic Adapters**: Switch between Anthropic, OpenAI, and Google models with hot-swap capability
- **Intelligent Decomposition**: Break requirements into themes, atomic requirements, and features
- **Backlog Management**: Priority-sorted features with readiness scoring
- **CI/CD Pipeline**: Automated testing and deployment to AWS

## Quick Start

### Prerequisites

- Node.js 20 LTS
- pnpm 9+
- Docker (for local development)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/entropy.git
cd entropy

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Start local services (PostgreSQL, Redis)
make db:up

# Start development servers
pnpm dev
```

### Available Commands

```bash
pnpm dev          # Start all services in development mode
pnpm build        # Build all packages
pnpm test         # Run tests
pnpm test:coverage # Run tests with coverage
pnpm lint         # Lint all packages
pnpm typecheck    # Type check all packages
pnpm format       # Format all files

# Database
make db:up        # Start PostgreSQL and Redis
make db:down      # Stop database services
make db:migrate   # Run migrations
```

## Project Structure

```
entropy/
├── packages/
│   ├── shared/          # Types, utilities, constants
│   ├── adapters/        # Model adapters (Anthropic, OpenAI, Google)
│   ├── agents/          # Agent framework
│   └── config/          # Configuration management
├── services/
│   ├── api/             # Express REST API
│   ├── orchestrator/    # Background workers
│   └── web/             # React frontend
├── infrastructure/
│   ├── terraform/       # AWS infrastructure as code
│   └── docker/          # Dockerfiles
├── .github/workflows/   # CI/CD pipelines
└── docs/                # Documentation
```

## Architecture

### Model Adapters (F-001)

The platform supports multiple AI providers through a unified adapter interface:

```typescript
interface ModelAdapter {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  stream(request: CompletionRequest): AsyncIterable<StreamChunk>;
  countTokens(text: string): number;
  estimateCost(tokens: TokenUsage): number;
  healthCheck(): Promise<boolean>;
}
```

Supported providers:
- **Anthropic**: Claude 4 Sonnet, Claude 4 Opus
- **OpenAI**: GPT-4o, GPT-4 Turbo
- **Google**: Gemini 1.5 Pro, Gemini 1.5 Flash

Features:
- Automatic fallback chains with circuit breaker
- Hot-swap configuration without restarts
- Cost tracking and token counting

### Agent Framework (F-002)

Agents handle specific AI-powered tasks:

- **ClassifierAgent**: Categorize requirements (new feature, enhancement, epic, bug fix)
- **DecomposerAgent**: Break requirements into atomic units and feature candidates

Each agent provides:
- Retry logic with exponential backoff
- Output validation against JSON schemas
- Quality scoring for responses
- Execution logging for audit

### Loop 0: Intake & Decomposition

1. Upload requirement document (PDF, DOCX, TXT, MD)
2. Extract text content
3. Classify requirement type
4. Decompose into themes, atomic requirements, features
5. Generate clarification questions
6. Calculate readiness scores

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/entropy

# Redis
REDIS_URL=redis://localhost:6379

# Model API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...

# AWS (for staging/production)
AWS_REGION=us-east-1
S3_BUCKET_UPLOADS=entropy-staging-uploads
```

See `.env.example` for all available options.

## Development

### Tech Stack

- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js 20 LTS
- **Package Manager**: pnpm 9+
- **Testing**: Vitest
- **Linting**: ESLint + Prettier
- **Database**: PostgreSQL 15 + pgvector
- **Cache**: Redis 7
- **Cloud**: AWS (ECS Fargate, RDS, S3, ElastiCache)
- **IaC**: Terraform 1.6+

### Package Aliases

- `@entropy/shared` - Shared types and utilities
- `@entropy/adapters` - Model adapter implementations
- `@entropy/agents` - Agent framework and implementations
- `@entropy/config` - Configuration management

### Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test -- --watch
```

## Deployment

### CI/CD Pipeline

- **CI**: Runs on every push - lint, typecheck, test, build
- **CD**: Deploys to staging on merge to main

### Infrastructure

Infrastructure is managed with Terraform:

```bash
cd infrastructure/terraform/environments/staging

# Initialize
terraform init

# Plan changes
terraform plan

# Apply changes
terraform apply
```

### AWS Resources

- VPC with public/private subnets
- ECS Fargate cluster
- RDS PostgreSQL
- ElastiCache Redis
- S3 buckets for storage
- Application Load Balancer

## API Endpoints

### Health

- `GET /health` - Service health check
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

### Requirements

- `POST /api/v1/requirements/upload` - Upload requirement document
- `GET /api/v1/requirements/:id` - Get requirement details
- `POST /api/v1/requirements/:id/decompose` - Start decomposition
- `GET /api/v1/requirements/:id/decomposition` - Get decomposition results

### Features

- `GET /api/v1/features` - List features (with filtering)
- `GET /api/v1/features/:id` - Get feature details
- `PATCH /api/v1/features/:id` - Update feature
- `POST /api/v1/features/:id/approve` - Approve for next loop

### Backlog

- `GET /api/v1/backlog` - Get backlog summary
- `GET /api/v1/backlog/now-playing` - Features in active loops
- `GET /api/v1/backlog/ready-soon` - High readiness features
- `GET /api/v1/backlog/needs-attention` - Features with blockers

## License

Proprietary - All rights reserved
