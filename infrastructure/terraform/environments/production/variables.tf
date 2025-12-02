# Production Environment Variables

variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region for production environment"
}

variable "certificate_arn" {
  type        = string
  description = "ARN of ACM certificate for HTTPS (required for production)"
}
