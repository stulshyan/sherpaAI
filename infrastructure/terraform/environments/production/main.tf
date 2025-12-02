# Production Environment Configuration (Placeholder)

terraform {
  required_version = ">= 1.6.0"

  backend "s3" {
    bucket         = "entropy-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "entropy-terraform-locks"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "entropy"
      Environment = "production"
      ManagedBy   = "terraform"
    }
  }
}

# Variables
variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "certificate_arn" {
  type        = string
  description = "ARN of ACM certificate for HTTPS"
}

# Local values
locals {
  environment = "production"
}

# Production configuration will be added when ready
# Key differences from staging:
# - Multi-AZ RDS
# - Multi-AZ NAT Gateway
# - Larger instance sizes
# - Auto-scaling configured
# - Enhanced monitoring
# - WAF enabled
