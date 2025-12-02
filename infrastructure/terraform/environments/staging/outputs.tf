# Staging Environment Outputs

# Networking
output "vpc_id" {
  description = "VPC ID"
  value       = module.networking.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.networking.private_subnet_ids
}

# Database
output "database_endpoint" {
  description = "RDS instance endpoint"
  value       = module.database.db_instance_address
  sensitive   = true
}

output "database_port" {
  description = "RDS instance port"
  value       = module.database.db_instance_port
}

output "database_secret_arn" {
  description = "ARN of the database credentials secret"
  value       = module.database.db_secret_arn
}

# Redis
output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = module.redis.endpoint
}

output "redis_port" {
  description = "ElastiCache Redis port"
  value       = module.redis.port
}

output "redis_connection_url" {
  description = "Redis connection URL (TLS enabled)"
  value       = module.redis.connection_url
}

# Storage
output "uploads_bucket" {
  description = "Uploads S3 bucket name"
  value       = module.storage.uploads_bucket_name
}

output "artifacts_bucket" {
  description = "Artifacts S3 bucket name"
  value       = module.storage.artifacts_bucket_name
}

output "prompts_bucket" {
  description = "Prompts S3 bucket name"
  value       = module.storage.prompts_bucket_name
}

# ECS
output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}

output "alb_dns_name" {
  description = "Application Load Balancer DNS name"
  value       = module.ecs.alb_dns_name
}

output "alb_zone_id" {
  description = "Application Load Balancer hosted zone ID"
  value       = module.ecs.alb_zone_id
}

# ECR Repositories
output "ecr_api_repository" {
  description = "ECR repository URL for API service"
  value       = module.ecs.api_repository_url
}

output "ecr_orchestrator_repository" {
  description = "ECR repository URL for Orchestrator service"
  value       = module.ecs.orchestrator_repository_url
}

output "ecr_web_repository" {
  description = "ECR repository URL for Web service"
  value       = module.ecs.web_repository_url
}
