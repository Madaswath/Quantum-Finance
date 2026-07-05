resource "aws_db_subnet_group" "default" {
  name       = "quantum-wealth-db-subnet-group-${var.environment}"
  subnet_ids = module.vpc.private_subnets

  tags = {
    Name = "Quantum Wealth DB Subnet Group"
  }
}

resource "aws_security_group" "rds" {
  name        = "quantum-wealth-rds-sg-${var.environment}"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "postgres" {
  identifier        = "quantum-wealth-db-${var.environment}"
  engine            = "postgres"
  engine_version    = "15.4" # Or higher to support latest pgvector
  instance_class    = var.db_instance_class
  allocated_storage = 20

  db_name  = "quantum_wealth"
  username = var.db_username
  password = var.db_password # In production, fetch this from AWS Secrets Manager!

  db_subnet_group_name   = aws_db_subnet_group.default.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  publicly_accessible = false
  skip_final_snapshot = var.environment != "production"

  backup_retention_period = var.environment == "production" ? 7 : 1
  storage_encrypted       = true
}
