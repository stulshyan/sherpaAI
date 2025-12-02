# Terraform Backend Configuration
# This file configures remote state storage

terraform {
  required_version = ">= 1.6.0"

  backend "s3" {
    # These values should be set via backend config file or CLI
    # terraform init -backend-config="backend.hcl"
    bucket         = "entropy-terraform-state"
    key            = "terraform.tfstate"
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
