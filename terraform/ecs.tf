resource "aws_ecs_cluster" "main" {
  name = "quantum-wealth-cluster-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/quantum-wealth-backend-${var.environment}"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/quantum-wealth-frontend-${var.environment}"
  retention_in_days = 30
}

# --- Backend Task Definition ---
resource "aws_ecs_task_definition" "backend" {
  family                   = "quantum-wealth-backend-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "backend-api"
      image     = var.backend_image_url
      cpu       = 256
      memory    = 512
      essential = true
      portMappings = [
        {
          containerPort = 8000
          hostPort      = 8000
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "DATABASE_URL", value = "postgresql+asyncpg://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.endpoint}/${aws_db_instance.postgres.db_name}" },
        { name = "ENVIRONMENT", value = var.environment },
        { name = "FRONTEND_URL", value = "https://${var.domain_name}" }
      ]
      secrets = [
        { name = "GEMINI_API_KEY", valueFrom = aws_secretsmanager_secret.gemini_api_key.arn },
        { name = "JWT_SECRET_KEY", valueFrom = aws_secretsmanager_secret.jwt_secret_key.arn }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])
}

# --- Frontend Task Definition ---
resource "aws_ecs_task_definition" "frontend" {
  family                   = "quantum-wealth-frontend-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "frontend-app"
      image     = var.frontend_image_url
      cpu       = 256
      memory    = 512
      essential = true
      portMappings = [
        {
          containerPort = 4000
          hostPort      = 4000
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "BACKEND_URL", value = "https://api.${var.domain_name}" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.frontend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])
}

# --- ECS Services ---
resource "aws_ecs_service" "backend" {
  name            = "backend-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.environment == "production" ? 2 : 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend-api"
    container_port   = 8000
  }

  depends_on = [aws_lb_listener.https]
}

resource "aws_ecs_service" "frontend" {
  name            = "frontend-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = var.environment == "production" ? 2 : 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend-app"
    container_port   = 4000
  }

  depends_on = [aws_lb_listener.https]
}
