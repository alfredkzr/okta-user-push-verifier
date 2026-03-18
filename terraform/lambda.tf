resource "aws_lambda_function" "app" {
  function_name = var.app_name
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
  role          = aws_iam_role.lambda_exec.arn
  timeout       = 60
  memory_size   = var.lambda_memory

  image_config {
    command = ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
  }

  environment {
    variables = {
      AWS_LWA_INVOKE_MODE   = "response_stream"
      PORT                  = "8000"
      AWS_LWA_READINESS_CHECK_PATH = "/api/health"
      DYNAMODB_TABLE_PREFIX = var.app_name
      ADMIN_GROUP           = "push-verifier-admin"
      USER_GROUP            = "push-verifier-user"
    }
  }
}

resource "aws_lambda_function_url" "app" {
  function_name      = aws_lambda_function.app.function_name
  authorization_type = "NONE"
  invoke_mode        = "RESPONSE_STREAM"

  cors {
    allow_origins = ["*"]
    allow_methods = ["*"]
    allow_headers = ["*"]
    max_age       = 86400
  }
}

# Inject secrets from Secrets Manager into Lambda env vars
# This is done via a null_resource to avoid storing secrets in Terraform state.
# After `terraform apply`, run:
#   ./deploy.sh
# which reads secrets and updates the Lambda configuration.
