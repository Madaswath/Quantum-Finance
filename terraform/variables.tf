variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (e.g., dev, beta, production)"
  type        = string
  default     = "beta"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "domain_name" {
  description = "The root domain name for the application (e.g., quantumwealth.app)"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ARN of the ACM certificate for HTTPS"
  type        = string
}

# --- Database Variables ---
variable "db_instance_class" {
  description = "RDS Instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_username" {
  description = "Database admin username"
  type        = string
  default     = "quantum_admin"
}

variable "db_password" {
  description = "Database admin password (should be passed securely via TF_VAR_db_password or Secrets Manager)"
  type        = string
  sensitive   = true
}

# --- Container Image URLs ---
variable "frontend_image_url" {
  description = "ECR URL for the frontend Docker image"
  type        = string
}

variable "backend_image_url" {
  description = "ECR URL for the backend Docker image"
  type        = string
}

# --- Application Secrets ---
variable "gemini_api_key" {
  description = "API key for Google Gemini (AI Diagnostics)"
  type        = string
  sensitive   = true
}

variable "jwt_secret_key" {
  description = "Secret key used for JWT token signing"
  type        = string
  sensitive   = true
}
