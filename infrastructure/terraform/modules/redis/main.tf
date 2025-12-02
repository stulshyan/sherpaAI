# ElastiCache Redis Module

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Variables
variable "environment" {
  type        = string
  description = "Environment name"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID"
}

variable "subnet_ids" {
  type        = list(string)
  description = "Subnet IDs for Redis"
}

variable "security_group_id" {
  type        = string
  description = "Security group ID for Redis"
}

variable "node_type" {
  type        = string
  default     = "cache.t3.micro"
  description = "ElastiCache node type"
}

variable "num_cache_nodes" {
  type        = number
  default     = 1
  description = "Number of cache nodes"
}

# Local values
locals {
  tags = {
    Environment = var.environment
    Module      = "redis"
  }
}

# Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "entropy-${var.environment}"
  subnet_ids = var.subnet_ids

  tags = local.tags
}

# Parameter Group
resource "aws_elasticache_parameter_group" "main" {
  family = "redis7"
  name   = "entropy-${var.environment}-redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  tags = local.tags
}

# Redis Replication Group (using replication group for encryption support)
resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "entropy-${var.environment}"
  description          = "Entropy ${var.environment} Redis cluster"

  engine               = "redis"
  engine_version       = "7.0"
  node_type            = var.node_type
  num_cache_clusters   = var.num_cache_nodes
  parameter_group_name = aws_elasticache_parameter_group.main.name
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [var.security_group_id]
  port                 = 6379

  # Encryption
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  # Disable automatic failover for single node (staging)
  automatic_failover_enabled = var.num_cache_nodes > 1

  # Snapshots
  snapshot_retention_limit = var.environment == "production" ? 7 : 0
  snapshot_window          = "03:00-04:00"
  maintenance_window       = "mon:04:00-mon:05:00"

  # Apply changes immediately in staging
  apply_immediately = var.environment != "production"

  tags = merge(local.tags, {
    Name = "entropy-${var.environment}-redis"
  })
}

# SSM Parameter for Redis URL
resource "aws_ssm_parameter" "redis_url" {
  name  = "/entropy/${var.environment}/redis-url"
  type  = "String"
  value = "rediss://${aws_elasticache_replication_group.main.primary_endpoint_address}:6379"

  tags = local.tags
}

# Outputs
output "replication_group_id" {
  description = "ElastiCache replication group ID"
  value       = aws_elasticache_replication_group.main.replication_group_id
}

output "endpoint" {
  description = "Redis primary endpoint address"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.main.port
}

output "redis_url_parameter_name" {
  description = "SSM parameter name for Redis URL"
  value       = aws_ssm_parameter.redis_url.name
}

output "connection_url" {
  description = "Full Redis connection URL (TLS enabled)"
  value       = "rediss://${aws_elasticache_replication_group.main.primary_endpoint_address}:6379"
}
