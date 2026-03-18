# Push Verifier

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.13+](https://img.shields.io/badge/Python-3.13+-3776AB.svg)](https://python.org)
[![Node 22+](https://img.shields.io/badge/Node-22+-339933.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg)](https://typescriptlang.org)

Identity verification tool powered by Okta Verify Push notifications. An operator enters a user's email, and the system sends a push challenge to their enrolled Okta Verify devices, streaming live verification status back to the browser.

## Features

- **Push Verification** — Send Okta Verify push challenges with real-time SSE streaming
- **Protected Users** — Exclude sensitive users from push verification (case-insensitive)
- **Role-Based Access** — Admin and operator roles via Okta groups
- **Audit Logging** — Track all verification attempts and admin actions
- **Rate Limiting** — 5 verifications per minute per IP via slowapi
- **Dark Mode** — System-aware theme with manual toggle
- **Docker Compose** — Single command to run the full stack

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│              │     │                  │     │             │
│   React SPA  │────>│  FastAPI + SSE   │────>│  Okta API   │
│   (Vite)     │     │  (Uvicorn)       │     │             │
│              │<────│                  │<────│             │
└──────────────┘     └────────┬─────────┘     └─────────────┘
                              │
                     ┌────────▼─────────┐
                     │                  │
                     │    DynamoDB      │
                     │ (Protected, Logs)│
                     │                  │
                     └──────────────────┘
```

**Auth flow**: Browser authenticates with Okta OIDC (PKCE), sends access token to backend. Backend validates JWT via JWKS, resolves role from Okta groups.

## Tech Stack

| Layer          | Technology                                    |
|----------------|-----------------------------------------------|
| Frontend       | React 19, TypeScript, Vite, Tailwind CSS v4   |
| Backend        | Python 3.13, FastAPI, httpx, PyJWT, slowapi   |
| Database       | Amazon DynamoDB (PAY_PER_REQUEST)              |
| Auth           | Okta OIDC (PKCE) + Okta API (private_key_jwt) |
| Infrastructure | Docker Compose                                |
| CI             | GitHub Actions                                 |

## Quick Start

### Prerequisites

- Python 3.13+
- Node.js 22+
- Docker Desktop (for local DynamoDB)
- An Okta developer account

### Setup

```bash
git clone <repo-url>
cd push-verifier
cp backend/.env.example backend/.env
# Edit backend/.env with your Okta configuration
```

### Run

```bash
chmod +x start.sh
./start.sh
```

This starts DynamoDB Local, the backend (port 8001), and frontend (port 5173).

- Frontend: http://localhost:5173
- Backend: http://localhost:8001
- DynamoDB Local: http://localhost:8002

## Docker

To run the full stack with Docker Compose:

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your Okta configuration
docker compose up
```

This builds the app container and starts it alongside DynamoDB Local. The `DYNAMODB_ENDPOINT_URL` is configured automatically in docker-compose.yml.

## Configuration

| Variable              | Description                              | Default              |
|-----------------------|------------------------------------------|----------------------|
| `OKTA_DOMAIN`         | Okta org URL                             | *required*           |
| `OKTA_CLIENT_ID`      | Service app client ID (API access)       | *required*           |
| `OKTA_PRIVATE_KEY_B64`| Base64-encoded PEM private key           | *required*           |
| `OKTA_KEY_ID`         | JWK key ID for private key               | `""`                 |
| `OKTA_SCOPES`         | OAuth scopes for Okta API calls          | `okta.users.manage`  |
| `OIDC_ISSUER`         | OIDC issuer URL for SPA auth             | *required*           |
| `OIDC_CLIENT_ID`      | SPA OIDC client ID                       | *required*           |
| `ADMIN_GROUP`         | Okta group name for admin role           | `push-verifier-admin`|
| `USER_GROUP`          | Okta group name for user role            | `push-verifier-user` |
| `DYNAMODB_ENDPOINT_URL`| DynamoDB endpoint (set automatically in docker-compose) | *(none)* |
| `DYNAMODB_TABLE_PREFIX`| Table name prefix                       | `push-verifier`      |

## Repository Structure

```
.
├── backend/
│   ├── main.py              # App factory, lifespan, middleware, SPA serving
│   ├── config.py            # Pydantic BaseSettings
│   ├── auth.py              # JWT validation, RBAC (admin/user roles)
│   ├── db.py                # DynamoDB operations
│   ├── models.py            # Pydantic request/response models
│   ├── rate_limit.py        # slowapi rate limiter setup
│   ├── requirements.txt
│   ├── routers/
│   │   ├── auth_routes.py   # /api/auth/config, /api/me
│   │   ├── verify.py        # POST /api/verify (SSE), /api/verification-log
│   │   ├── settings.py      # Protected users CRUD, audit log (admin only)
│   │   └── health.py        # /api/health
│   └── services/
│       └── okta.py          # Okta API: user lookup, push verify, polling
├── frontend/
│   ├── index.html           # HTML entry point
│   ├── src/
│   │   ├── main.tsx         # Bootstrap: fetch auth config, init OktaAuth
│   │   ├── App.tsx          # Routes + auth guards
│   │   ├── auth.tsx         # Auth context (tokens, role, headers)
│   │   ├── index.css        # Tailwind v4 theme + custom animations
│   │   ├── lib/
│   │   │   └── utils.ts     # Classname helper, relative time formatting
│   │   └── components/
│   │       ├── Layout.tsx       # Sidebar nav, responsive
│   │       ├── LoginPage.tsx    # Okta OIDC login
│   │       ├── VerifierPage.tsx # Push verification + activity log
│   │       ├── SettingsPage.tsx # Protected users management + audit log
│   │       └── ThemeContext.tsx  # Dark/light theme
│   ├── package.json
│   └── vite.config.ts      # Proxy /api to backend in dev
├── Dockerfile               # Multi-stage build
├── docker-compose.yml       # App + DynamoDB Local
├── start.sh                 # One-command local dev startup
├── .github/workflows/ci.yml # Lint + build checks
├── CONTRIBUTING.md
└── LICENSE (MIT)
```

## Okta Setup

You need two Okta applications:

1. **SPA Application** (for frontend login): OIDC Web App with Authorization Code + PKCE, redirect URI `http://localhost:5173/login/callback`
2. **Service Application** (for backend API calls): OAuth 2.0 service app with `private_key_jwt` client authentication and `okta.users.manage` scope

Create two Okta groups (`push-verifier-admin`, `push-verifier-user`) and assign users accordingly. Add a "groups" claim to your authorization server so group membership is included in tokens.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
