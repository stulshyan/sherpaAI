# Staging Environment Variables

variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region for staging environment"
}

variable "certificate_arn" {
  type        = string
  default     = ""
  description = "ARN of ACM certificate for HTTPS (optional for staging)"
}
