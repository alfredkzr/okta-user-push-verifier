# Secret values must be set manually after terraform apply:
# aws secretsmanager put-secret-value --secret-id push-verifier/production/config \
#   --secret-string '{"OKTA_DOMAIN":"...","OKTA_CLIENT_ID":"...","OKTA_PRIVATE_KEY_B64":"...","OKTA_KEY_ID":"...","OIDC_ISSUER":"...","OIDC_CLIENT_ID":"..."}'

resource "aws_secretsmanager_secret" "app" {
  name        = "${var.app_name}/${var.environment}/config"
  description = "Application configuration for Push Verifier"
}
