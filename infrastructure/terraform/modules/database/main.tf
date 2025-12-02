# RDS PostgreSQL Module

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
  description = "Subnet IDs for DB subnet group"
}

variable "security_group_id" {
  type        = string
  description = "Security group ID for RDS"
}

variable "instance_class" {
  type        = string
  default     = "db.t3.micro"
  description = "RDS instance class"
}

variable "allocated_storage" {
  type        = number
  default     = 20
  description = "Allocated storage in GB"
}

variable "multi_az" {
  type        = bool
  default     = false
  description = "Enable Multi-AZ deployment"
}

# Local values
locals {
  tags = {
    Environment = var.environment
    Module      = "database"
  }
}

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "entropy-${var.environment}"
  subnet_ids = var.subnet_ids

  tags = merge(local.tags, {
    Name = "entropy-${var.environment}-db-subnet-group"
  })
}

# DB Parameter Group with pgvector
resource "aws_db_parameter_group" "main" {
  name   = "entropy-${var.environment}-pg15"
  family = "postgres15"

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  parameter {
    name  = "log_statement"
    value = "ddl"
  }

  tags = local.tags
}

# Generate random password
resource "random_password" "db_password" {
  length  = 32
  special = false
}

# Store password in Secrets Manager
resource "aws_secretsmanager_secret" "db_credentials" {
  name = "entropy-${var.environment}-db-credentials"

  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = "entropy"
    password = random_password.db_password.result
    engine   = "postgres"
    host     = aws_db_instance.main.address
    port     = 5432
    dbname   = "entropy"
  })
}

# RDS Instance
resource "aws_db_instance" "main" {
  identifier = "entropy-${var.environment}"

  engine         = "postgres"
  engine_version = "15"
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.allocated_storage * 5
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "entropy"
  username = "entropy"
  password = random_password.db_password.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.security_group_id]
  parameter_group_name   = aws_db_parameter_group.main.name

  multi_az               = var.multi_az
  publicly_accessible    = false
  skip_final_snapshot    = var.environment != "production"
  deletion_protection    = var.environment == "production"
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  performance_insights_enabled = true
  monitoring_interval          = 60
  monitoring_role_arn          = aws_iam_role.rds_monitoring.arn

  tags = merge(local.tags, {
    Name = "entropy-${var.environment}-postgres"
  })
}

# IAM Role for Enhanced Monitoring
resource "aws_iam_role" "rds_monitoring" {
  name = "entropy-${var.environment}-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# SSM Parameter for connection string
resource "aws_ssm_parameter" "db_url" {
  name  = "/entropy/${var.environment}/database-url"
  type  = "SecureString"
  value = "postgresql://entropy:${random_password.db_password.result}@${aws_db_instance.main.address}:5432/entropy"

  tags = local.tags
}

# Outputs
output "db_instance_id" {
  value = aws_db_instance.main.id
}

output "db_instance_address" {
  value = aws_db_instance.main.address
}

output "db_instance_port" {
  value = aws_db_instance.main.port
}

output "db_secret_arn" {
  value = aws_secretsmanager_secret.db_credentials.arn
}

output "db_url_parameter_name" {
  value = aws_ssm_parameter.db_url.name
}
