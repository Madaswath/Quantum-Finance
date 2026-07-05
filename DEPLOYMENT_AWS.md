# Quantum Wealth: AWS Deployment Guide

This guide outlines how to provision the entire Quantum Wealth infrastructure on AWS using the provided Terraform configurations.

## Architecture Overview
The Terraform scripts will provision:
*   A **VPC** with public and private subnets, ensuring strong network isolation.
*   An **Application Load Balancer (ALB)** handling HTTPS traffic securely.
*   An **ECS Fargate Cluster** running the Angular SSR frontend and FastAPI backend dynamically and serverlessly.
*   An **RDS PostgreSQL** database safely nestled in a private subnet, pre-configured for security.
*   Appropriate **IAM Roles** and Security Groups.

## Prerequisites
1.  **AWS Account & CLI:** You must have the AWS CLI installed and configured with Administrator credentials (`aws configure`).
2.  **Terraform:** Install Terraform (>= v1.5.0).
3.  **Domain & ACM Certificate:** You need a registered domain name and an active AWS Certificate Manager (ACM) certificate ARN for HTTPS termination on the ALB.
4.  **ECR Repositories:** You must build and push the `frontend` and `backend` Docker images to AWS ECR before applying Terraform.

## Step-by-Step Deployment

### 1. Build and Push Container Images to ECR
First, create two ECR repositories in your AWS console (e.g., `qw-frontend` and `qw-backend`). Then authenticate, build, and push your images.

```bash
# Authenticate Docker to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <YOUR_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

# Build and Push Backend
docker build -t qw-backend ./backend
docker tag qw-backend:latest <YOUR_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/qw-backend:latest
docker push <YOUR_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/qw-backend:latest

# Build and Push Frontend
docker build -t qw-frontend -f Dockerfile.frontend .
docker tag qw-frontend:latest <YOUR_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/qw-frontend:latest
docker push <YOUR_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/qw-frontend:latest
```

### 2. Configure Terraform Variables
Create a file named `terraform/terraform.tfvars` (do not commit this file to version control as it will contain secrets).

```hcl
aws_region          = "us-east-1"
environment         = "beta"
domain_name         = "yourdomain.com"
acm_certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/abc-123"

# Docker Image URLs from Step 1
frontend_image_url  = "123456789012.dkr.ecr.us-east-1.amazonaws.com/qw-frontend:latest"
backend_image_url   = "123456789012.dkr.ecr.us-east-1.amazonaws.com/qw-backend:latest"

# Secrets (For production, consider AWS Secrets Manager instead)
db_password         = "YourSuperSecureDbPassword123!"
gemini_api_key      = "AIzaSyYourGeminiApiKeyHere..."
jwt_secret_key      = "YourSuperSecureJwtSecretKey123!"
```

### 3. Initialize and Apply Terraform
Navigate to the terraform directory and run the standard provisioning commands.

```bash
cd terraform

# Initialize providers and download modules
terraform init

# Review the execution plan
terraform plan

# Apply the configuration to build the infrastructure
terraform apply
```

Type `yes` when prompted. Provisioning the database and ECS cluster will take several minutes.

### 4. Post-Deployment Steps
1.  **DNS Configuration:** After Terraform finishes, it will output the `alb_dns_name`. Go to your domain registrar (e.g., Route53, Cloudflare) and create a CNAME record pointing your domain (e.g., `quantumwealth.app` and `api.quantumwealth.app`) to this ALB DNS name.
2.  **Database Migrations:** The backend will auto-create the database tables upon startup if they do not exist. However, for a production environment, you should connect to the database via a bastion host or VPN and run Alembic migrations.

---
*Note: To destroy the infrastructure and stop incurring costs, run `terraform destroy`.*