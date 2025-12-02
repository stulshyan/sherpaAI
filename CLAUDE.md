# Entropy Platform - Claude Code Context

## Project Overview

Entropy is an AI-powered requirements decomposition and backlog management platform. It helps teams break down complex requirements into actionable features using multiple AI model providers.

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Package Manager**: pnpm (v9+)
- **Monorepo**: pnpm workspaces
- **Runtime**: Node.js 20 LTS
- **Testing**: Vitest
- **Linting**: ESLint + Prettier
- **Database**: PostgreSQL 15 with pgvector
- **Cache**: Redis 7
- **Cloud**: AWS (ECS Fargate, RDS, S3)
- **IaC**: Terraform

## Directory Structure

```
entropy/
├── packages/
│   ├── shared/          # Types, utils, constants
│   ├── adapters/        # Model adapters (Anthropic, OpenAI, Google)
│   ├── agents/          # Agent framework
│   └── config/          # Configuration management
├── services/
│   ├── api/             # Express backend
│   ├── orchestrator/    # Background workers
│   └── web/             # React frontend
├── infrastructure/
│   ├── terraform/       # AWS IaC
│   └── docker/          # Dockerfiles
└── docs/
```

## Quick Commands

```bash
# Install dependencies
pnpm install

# Start development (all services)
pnpm dev

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Lint code
pnpm lint

# Format code
pnpm format

# Type check
pnpm typecheck

# Build all packages
pnpm build

# Start database services
make db:up

# Stop database services
make db:down
```

## Package Aliases

- `@entropy/shared` - Shared types and utilities
- `@entropy/adapters` - Model adapters
- `@entropy/agents` - Agent framework
- `@entropy/config` - Configuration

## Key Concepts

### Model Adapters (F-001)
Located in `packages/adapters/`. Provides a unified interface for different AI providers:
- AnthropicAdapter - Claude models
- OpenAIAdapter - GPT models
- GoogleAdapter - Gemini models
- FallbackAdapter - Automatic failover

### Agent Framework (F-002)
Located in `packages/agents/`. Base classes and utilities for AI agents:
- BaseAgent - Abstract class with lifecycle hooks
- PromptEngine - Template rendering
- OutputValidator - JSON Schema validation
- QualityScorer - Output quality metrics

### Core Agents
- ClassifierAgent - Requirement type classification
- DecomposerAgent - Break requirements into features

## Environment Variables

Copy `.env.example` to `.env` and configure:
- Database URL
- Redis URL
- API keys (Anthropic, OpenAI, Google)
- AWS credentials

## Testing

Tests are co-located with source files (`*.test.ts`). Run with:
```bash
pnpm test              # Run all tests
pnpm test:coverage     # With coverage report
pnpm test:watch        # Watch mode
```

## CI/CD

- **CI**: Runs on every push/PR - lint, typecheck, test, build
- **CD**: Deploys to staging on merge to main

## Notes for Claude Code

1. All scripts work without GUI - use CLI tools
2. Database connects via environment variables
3. No hardcoded localhost references
4. Can run tests and trigger GitHub Actions from terminal
5. Use `npx` for CLI tools instead of global installs
