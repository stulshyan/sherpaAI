# Staging Environment Configuration

terraform {
  required_version = ">= 1.6.0"

  backend "s3" {
    bucket         = "entropy-terraform-state"
    key            = "staging/terraform.tfstate"
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
      Environment = "staging"
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
  default     = ""
}

# Local values
locals {
  environment = "staging"
}

# Networking
module "networking" {
  source = "../../modules/networking"

  environment        = local.environment
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b"]
}

# Database
module "database" {
  source = "../../modules/database"

  environment       = local.environment
  vpc_id            = module.networking.vpc_id
  subnet_ids        = module.networking.private_subnet_ids
  security_group_id = module.networking.rds_security_group_id
  instance_class    = "db.t3.micro"
  allocated_storage = 20
  multi_az          = false
}

# Storage
module "storage" {
  source = "../../modules/storage"

  environment = local.environment
}

# Redis
module "redis" {
  source = "../../modules/redis"

  environment       = local.environment
  vpc_id            = module.networking.vpc_id
  subnet_ids        = module.networking.private_subnet_ids
  security_group_id = module.networking.redis_security_group_id
  node_type         = "cache.t3.micro"
  num_cache_nodes   = 1
}

# ECS
module "ecs" {
  source = "../../modules/ecs"

  environment           = local.environment
  vpc_id                = module.networking.vpc_id
  public_subnet_ids     = module.networking.public_subnet_ids
  private_subnet_ids    = module.networking.private_subnet_ids
  alb_security_group_id = module.networking.alb_security_group_id
  ecs_security_group_id = module.networking.ecs_security_group_id
  db_secret_arn         = module.database.db_secret_arn
  certificate_arn       = var.certificate_arn

  s3_bucket_arns = [
    module.storage.uploads_bucket_arn,
    module.storage.artifacts_bucket_arn,
    module.storage.prompts_bucket_arn,
  ]

  api_cpu             = 256
  api_memory          = 512
  orchestrator_cpu    = 256
  orchestrator_memory = 512
}

# Outputs
output "vpc_id" {
  value = module.networking.vpc_id
}

output "alb_dns_name" {
  value = module.ecs.alb_dns_name
}

output "database_endpoint" {
  value     = module.database.db_instance_address
  sensitive = true
}

output "redis_endpoint" {
  value = module.redis.endpoint
}

output "ecr_api_repository" {
  value = module.ecs.api_repository_url
}

output "ecr_orchestrator_repository" {
  value = module.ecs.orchestrator_repository_url
}

output "ecr_web_repository" {
  value = module.ecs.web_repository_url
}

output "uploads_bucket" {
  value = module.storage.uploads_bucket_name
}

output "artifacts_bucket" {
  value = module.storage.artifacts_bucket_name
}

output "prompts_bucket" {
  value = module.storage.prompts_bucket_name
}
