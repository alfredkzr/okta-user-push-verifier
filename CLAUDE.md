# Push Verifier — Developer Guide

## What this project does

Open-source identity verification tool:

- Operator enters a username/email
- Backend sends Okta Verify Push challenges to all active enrolled devices
- Backend polls transaction status for up to 30 seconds
- Frontend receives live progress via SSE and displays result
- Protected users can be excluded from verification
- Admin audit logs track all changes and verification attempts

## Architecture

- **Frontend**: React 19 SPA (Vite + Tailwind CSS v4)
- **Backend**: FastAPI (Python 3.13+, Uvicorn)
- **Database**: DynamoDB (PAY_PER_REQUEST billing)
- **Auth**: Okta OIDC (PKCE) for SPA, `private_key_jwt` for service API calls
- **Infra**: AWS Lambda (Function URL + Lambda Web Adapter) + ECR + Secrets Manager
- **CI**: GitHub Actions

## Repository Structure

```
.
├── backend/
│   ├── main.py              # App factory, lifespan, middleware, SPA serving
│   ├── config.py            # Pydantic BaseSettings
│   ├── auth.py              # JWT validation, RBAC (admin/user roles)
│   ├── db.py                # DynamoDB operations
│   ├── models.py            # Pydantic request/response models
│   ├── requirements.txt
│   ├── routers/
│   │   ├── auth_routes.py   # /api/auth/config, /api/me
│   │   ├── verify.py        # POST /api/verify (SSE), /api/verification-log
│   │   ├── settings.py      # Protected users CRUD, audit log (admin only)
│   │   └── health.py        # /api/health
│   └── services/
│       └── okta.py          # Okta API: user lookup, push verify, polling
├── frontend/
│   ├── src/
│   │   ├── main.tsx         # Bootstrap: fetch auth config, init OktaAuth
│   │   ├── App.tsx          # Routes + auth guards
│   │   ├── auth.tsx         # Auth context (tokens, role, headers)
│   │   └── components/
│   │       ├── Layout.tsx       # Sidebar nav, responsive
│   │       ├── LoginPage.tsx    # Okta OIDC login
│   │       ├── VerifierPage.tsx # Push verification + activity log
│   │       ├── SettingsPage.tsx # Protected users management + audit log
│   │       └── ThemeContext.tsx  # Dark/light theme
│   ├── package.json
│   └── vite.config.ts      # Proxy /api to backend in dev
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── ecr.tf              # Container registry
│   ├── lambda.tf            # Lambda function + Function URL
│   ├── dynamodb.tf          # Tables (PAY_PER_REQUEST)
│   ├── secrets.tf           # Secrets Manager
│   └── iam.tf              # Lambda execution role
├── Dockerfile               # Multi-stage: Node build → Python runtime (server + lambda targets)
├── docker-compose.yml       # DynamoDB Local for dev
├── start.sh                 # One-command local dev startup
├── deploy.sh                # Build, push to ECR, deploy Lambda
├── .github/workflows/ci.yml
├── README.md
├── CONTRIBUTING.md
└── LICENSE (MIT)
```

## Local Development

```bash
./start.sh
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- DynamoDB Local: http://localhost:8002

## Docker Targets

The Dockerfile has two build targets:

- `docker build --target server .` — Traditional Docker host (local, ECS, App Runner)
- `docker build --target lambda .` — AWS Lambda via Lambda Web Adapter (production)

## Key Patterns

- Backend routes split into `routers/` — add new endpoints there
- Auth rules in `auth.py` — `require_authenticated` and `require_admin` are FastAPI dependencies
- Okta API calls in `services/okta.py` — async generator yields SSE events
- DynamoDB operations in `db.py` — tables auto-created on startup
- Frontend uses `useAuth()` hook for tokens and role
- API proxy in `vite.config.ts` for dev
- Production: frontend build copied to `backend/static/`, served by FastAPI SPA catch-all

## Deployment

Uses AWS Lambda with Function URL (~$0.50/month).

```bash
cd terraform && terraform apply
# Set secrets in Secrets Manager
./deploy.sh
```
