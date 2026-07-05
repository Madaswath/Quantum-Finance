resource "aws_secretsmanager_secret" "db_password" {
  name        = "quantum-wealth-db-password-${var.environment}"
  description = "Database password for RDS"
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = var.db_password
}

resource "aws_secretsmanager_secret" "jwt_secret_key" {
  name        = "quantum-wealth-jwt-secret-key-${var.environment}"
  description = "JWT secret key for backend authentication"
}

resource "aws_secretsmanager_secret_version" "jwt_secret_key" {
  secret_id     = aws_secretsmanager_secret.jwt_secret_key.id
  secret_string = var.jwt_secret_key
}

resource "aws_secretsmanager_secret" "gemini_api_key" {
  name        = "quantum-wealth-gemini-api-key-${var.environment}"
  description = "Google Gemini API Key for Fiduciary Diagnostics"
}

resource "aws_secretsmanager_secret_version" "gemini_api_key" {
  secret_id     = aws_secretsmanager_secret.gemini_api_key.id
  secret_string = var.gemini_api_key
}
