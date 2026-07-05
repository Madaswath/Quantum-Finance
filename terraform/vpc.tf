data "aws_availability_zones" "available" {
  state = "available"
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.2"

  name = "quantum-wealth-vpc-${var.environment}"
  cidr = var.vpc_cidr

  azs             = slice(data.aws_availability_zones.available.names, 0, 2)
  private_subnets = [for k, v in slice(data.aws_availability_zones.available.names, 0, 2) : cidrsubnet(var.vpc_cidr, 8, k)]
  public_subnets  = [for k, v in slice(data.aws_availability_zones.available.names, 0, 2) : cidrsubnet(var.vpc_cidr, 8, k + 4)]

  enable_nat_gateway     = true
  single_nat_gateway     = var.environment != "production" # Save costs on non-prod
  one_nat_gateway_per_az = var.environment == "production"

  enable_dns_hostnames = true
  enable_dns_support   = true

  public_subnet_tags = {
    Type = "Public"
  }
  private_subnet_tags = {
    Type = "Private"
  }
}
