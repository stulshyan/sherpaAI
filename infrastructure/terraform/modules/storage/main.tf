# S3 Storage Module

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

variable "ecs_task_role_arn" {
  type        = string
  description = "ARN of ECS task role for bucket policy"
  default     = ""
}

# Local values
locals {
  bucket_prefix = "entropy-${var.environment}"

  tags = {
    Environment = var.environment
    Module      = "storage"
  }
}

# Uploads bucket - for requirement documents
resource "aws_s3_bucket" "uploads" {
  bucket = "${local.bucket_prefix}-uploads"

  tags = merge(local.tags, {
    Name = "${local.bucket_prefix}-uploads"
  })
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "move-to-ia"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }
  }
}

# Artifacts bucket - for generated outputs
resource "aws_s3_bucket" "artifacts" {
  bucket = "${local.bucket_prefix}-artifacts"

  tags = merge(local.tags, {
    Name = "${local.bucket_prefix}-artifacts"
  })
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    id     = "move-to-ia"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }
  }
}

# Prompts bucket - for agent prompt templates
resource "aws_s3_bucket" "prompts" {
  bucket = "${local.bucket_prefix}-prompts"

  tags = merge(local.tags, {
    Name = "${local.bucket_prefix}-prompts"
  })
}

resource "aws_s3_bucket_versioning" "prompts" {
  bucket = aws_s3_bucket.prompts.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "prompts" {
  bucket = aws_s3_bucket.prompts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "prompts" {
  bucket = aws_s3_bucket.prompts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORS configuration for uploads bucket (for presigned URLs)
resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["*"] # Should be restricted in production
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# Outputs
output "uploads_bucket_name" {
  value = aws_s3_bucket.uploads.id
}

output "uploads_bucket_arn" {
  value = aws_s3_bucket.uploads.arn
}

output "artifacts_bucket_name" {
  value = aws_s3_bucket.artifacts.id
}

output "artifacts_bucket_arn" {
  value = aws_s3_bucket.artifacts.arn
}

output "prompts_bucket_name" {
  value = aws_s3_bucket.prompts.id
}

output "prompts_bucket_arn" {
  value = aws_s3_bucket.prompts.arn
}
