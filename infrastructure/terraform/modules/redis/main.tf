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

# Redis Cluster
resource "aws_elasticache_cluster" "main" {
  cluster_id           = "entropy-${var.environment}"
  engine               = "redis"
  engine_version       = "7.0"
  node_type            = var.node_type
  num_cache_nodes      = var.num_cache_nodes
  parameter_group_name = aws_elasticache_parameter_group.main.name
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [var.security_group_id]
  port                 = 6379

  snapshot_retention_limit = var.environment == "production" ? 7 : 0
  snapshot_window          = "03:00-04:00"
  maintenance_window       = "mon:04:00-mon:05:00"

  tags = merge(local.tags, {
    Name = "entropy-${var.environment}-redis"
  })
}

# SSM Parameter for Redis URL
resource "aws_ssm_parameter" "redis_url" {
  name  = "/entropy/${var.environment}/redis-url"
  type  = "String"
  value = "redis://${aws_elasticache_cluster.main.cache_nodes[0].address}:6379"

  tags = local.tags
}

# Outputs
output "cluster_id" {
  value = aws_elasticache_cluster.main.cluster_id
}

output "cache_nodes" {
  value = aws_elasticache_cluster.main.cache_nodes
}

output "endpoint" {
  value = aws_elasticache_cluster.main.cache_nodes[0].address
}

output "port" {
  value = aws_elasticache_cluster.main.port
}

output "redis_url_parameter_name" {
  value = aws_ssm_parameter.redis_url.name
}
