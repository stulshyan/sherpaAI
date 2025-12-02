.PHONY: dev test lint build clean db docker help

# Default target
help:
	@echo "Entropy Platform - Available commands:"
	@echo ""
	@echo "  make dev        - Start all services in development mode"
	@echo "  make test       - Run all tests"
	@echo "  make lint       - Lint all packages"
	@echo "  make build      - Build all packages"
	@echo "  make clean      - Clean all build artifacts"
	@echo "  make db:up      - Start database services (PostgreSQL, Redis)"
	@echo "  make db:down    - Stop database services"
	@echo "  make db:migrate - Run database migrations"
	@echo "  make docker:build - Build Docker images"
	@echo "  make install    - Install all dependencies"
	@echo ""

# Development
dev:
	pnpm run dev

# Install dependencies
install:
	pnpm install

# Testing
test:
	pnpm test

test-coverage:
	pnpm test:coverage

# Linting
lint:
	pnpm lint

lint-fix:
	pnpm lint:fix

format:
	pnpm format

# Building
build:
	pnpm build

typecheck:
	pnpm typecheck

# Cleaning
clean:
	pnpm clean
	rm -rf node_modules
	rm -rf packages/*/node_modules
	rm -rf services/*/node_modules

# Database
db\:up:
	docker compose -f infrastructure/docker/docker-compose.dev.yml up -d

db\:down:
	docker compose -f infrastructure/docker/docker-compose.dev.yml down

db\:migrate:
	pnpm db:migrate

db\:seed:
	pnpm db:seed

# Docker
docker\:build:
	docker compose -f infrastructure/docker/docker-compose.yml build

docker\:up:
	docker compose -f infrastructure/docker/docker-compose.yml up -d

docker\:down:
	docker compose -f infrastructure/docker/docker-compose.yml down

# Setup
setup: install db:up
	@echo "Setup complete. Copy .env.example to .env and configure your settings."
