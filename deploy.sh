#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

info() { echo -e "${CYAN}[info]${NC} $1"; }
ok() { echo -e "${GREEN}[ok]${NC} $1"; }
fail() { echo -e "${RED}[error]${NC} $1"; exit 1; }

for cmd in aws docker; do
  command -v "$cmd" >/dev/null 2>&1 || fail "$cmd is required"
done

AWS_REGION="${AWS_REGION:-us-east-1}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

if [ -d terraform ]; then
  ECR_REPO=$(cd terraform && terraform output -raw ecr_repository_url 2>/dev/null || echo "")
  FUNCTION_NAME=$(cd terraform && terraform output -raw lambda_function_name 2>/dev/null || echo "")
  SECRET_ARN=$(cd terraform && terraform output -raw secret_arn 2>/dev/null || echo "")
fi

ECR_REPO="${ECR_REPO:?Set ECR_REPO or run terraform apply first}"
FUNCTION_NAME="${FUNCTION_NAME:?Set FUNCTION_NAME or run terraform apply first}"

ACCOUNT_ID=$(echo "$ECR_REPO" | cut -d. -f1)
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

info "Logging into ECR..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"

info "Building Docker image (Lambda target)..."
docker build --platform linux/amd64 --target lambda -t "push-verifier:${IMAGE_TAG}" .

info "Tagging and pushing..."
docker tag "push-verifier:${IMAGE_TAG}" "${ECR_REPO}:${IMAGE_TAG}"
docker push "${ECR_REPO}:${IMAGE_TAG}"
ok "Image pushed to ${ECR_REPO}:${IMAGE_TAG}"

# Inject secrets into Lambda environment variables
if [ -n "${SECRET_ARN:-}" ]; then
  info "Loading secrets from Secrets Manager..."
  SECRETS_JSON=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" --region "$AWS_REGION" --query SecretString --output text)

  OKTA_DOMAIN=$(echo "$SECRETS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('OKTA_DOMAIN',''))")
  OKTA_CLIENT_ID=$(echo "$SECRETS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('OKTA_CLIENT_ID',''))")
  OKTA_PRIVATE_KEY_B64=$(echo "$SECRETS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('OKTA_PRIVATE_KEY_B64',''))")
  OKTA_KEY_ID=$(echo "$SECRETS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('OKTA_KEY_ID',''))")
  OIDC_ISSUER=$(echo "$SECRETS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('OIDC_ISSUER',''))")
  OIDC_CLIENT_ID=$(echo "$SECRETS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('OIDC_CLIENT_ID',''))")

  info "Updating Lambda environment variables..."
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --region "$AWS_REGION" \
    --environment "Variables={AWS_LWA_INVOKE_MODE=response_stream,PORT=8000,AWS_LWA_READINESS_CHECK_PATH=/api/health,DYNAMODB_TABLE_PREFIX=push-verifier,ADMIN_GROUP=push-verifier-admin,USER_GROUP=push-verifier-user,OKTA_DOMAIN=${OKTA_DOMAIN},OKTA_CLIENT_ID=${OKTA_CLIENT_ID},OKTA_PRIVATE_KEY_B64=${OKTA_PRIVATE_KEY_B64},OKTA_KEY_ID=${OKTA_KEY_ID},OIDC_ISSUER=${OIDC_ISSUER},OIDC_CLIENT_ID=${OIDC_CLIENT_ID}}" \
    --output text --query 'FunctionName' >/dev/null

  info "Waiting for configuration update..."
  aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$AWS_REGION"
fi

info "Updating Lambda to use new image..."
aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --image-uri "${ECR_REPO}:${IMAGE_TAG}" \
  --region "$AWS_REGION" \
  --output text --query 'FunctionName' >/dev/null

info "Waiting for update..."
aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$AWS_REGION"

APP_URL=$(cd terraform && terraform output -raw app_url 2>/dev/null || echo "")
ok "Deployment complete!${APP_URL:+ URL: $APP_URL}"
