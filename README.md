# StellarIDE

> The premium, browser-based smart contract IDE for the [Stellar](https://stellar.org) / [Soroban](https://soroban.stellar.org) ecosystem.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Overview

**StellarIDE** is a full-stack, browser-native IDE that lets Soroban smart contract developers write, compile, test, audit, and deploy contracts without installing a local toolchain.

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Editor | Monaco Editor (VS Code engine) |
| State | Zustand |
| Routing | React Router v7 |
| HTTP | Axios |
| Icons | Lucide React |
| Backend | Rust + Axum |
| Database | PostgreSQL (Neon or self-hosted) |
| Auth | JWT + GitHub/Google OAuth |
| AI Chat | Groq API (`llama-3.1-8b-instant` by default) |
| ORM / Migrations | SQLx |
| Infra | Docker + Docker Compose |

---

## Folder Structure

```
IDEStellar/
├── frontend/                # React + Vite SPA
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   │   └── ui/          # Button, Input, Card, Modal, Toast, ChatPanel
│   │   ├── features/
│   │   │   ├── auth/        # Auth store (Zustand) — email, GitHub, Google
│   │   │   ├── dashboard/   # Dashboard store
│   │   │   ├── ide/         # IDE store + chat store
│   │   │   └── landing/     # Landing page sections incl. DevResourcesSection
│   │   ├── layouts/         # PublicLayout, AuthLayout, ProtectedLayout
│   │   ├── pages/           # LandingPage, LoginPage, RegisterPage, DashboardPage, IdePage, OAuthCallbackPage, NotFoundPage
│   │   ├── hooks/           # useToast
│   │   ├── services/        # Axios API client
│   │   └── assets/          # Static assets
│   ├── .env.example
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── backend/                 # Rust + Axum REST API
│   ├── src/
│   │   ├── main.rs
│   │   ├── config.rs
│   │   ├── errors.rs
│   │   ├── db/              # PgPool setup + migrations
│   │   ├── models/          # user, project, project_file
│   │   ├── handlers/        # health, auth, oauth, ai, projects
│   │   ├── middleware/      # JWT auth middleware
│   │   └── routes/          # Router builder
│   ├── migrations/          # SQLx SQL migrations
│   ├── .env.example
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Quick Start (Docker)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) + Docker Compose v2
- A PostgreSQL database — either local (started by Docker Compose) or [Neon](https://neon.tech) (free tier)

### 1. Clone and configure

```bash
git clone https://github.com/Alouzious/IDEStellar.git
cd IDEStellar
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET
```

### 2. Start all services

```bash
docker compose up --build
```

Compose starts:
- `postgres` (local database with healthcheck)
- `sandbox` (Rust + Soroban CLI + Scout tooling image)
- `backend` (API + Docker socket execution)
- `frontend` (Nginx SPA with `/api` proxy to backend)

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080 |
| Health check | http://localhost:8080/api/v1/health |

---

## Local Development (without Docker)

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev          # starts on http://localhost:5173
```

### Backend

Requires Rust + a running PostgreSQL database.

```bash
cd backend
cp .env.example .env
# Edit DATABASE_URL to point to your Postgres instance

cargo run
# API available at http://localhost:8080
```

### Soroban feature verification

Build/Test/Deploy/Audit create a temporary project workspace and execute Soroban commands in a sandbox (`SOROBAN_EXECUTION_MODE=docker` by default). The backend executes:

```bash
docker run --rm <sandbox-image> ...
```

For Docker Compose, host `/tmp` is mounted into backend so workspace mounts resolve correctly when using `/var/run/docker.sock`.

```bash
# backend verification
cd backend
cargo check
cargo test

# frontend verification
cd ../frontend
npm run lint
npm run build
```

Deploy supports Freighter wallet-aware flow in the IDE and backend CLI deployment when `SOROBAN_DEPLOY_SECRET_KEY` is configured.

---

## Neon PostgreSQL Setup

1. Create a free account at [neon.tech](https://neon.tech)
2. Create a new project and copy the **connection string**
3. Set `DATABASE_URL` in your `.env`:

```
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/stellaride?sslmode=require
```

Migrations run automatically on startup via SQLx.

> Compose defaults to local Postgres. You can still point `DATABASE_URL` to Neon; local Postgres will remain available as fallback.

---

## OAuth Setup (Optional)

### GitHub OAuth

1. Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**
2. Set **Callback URL** to: `http://localhost:8080/api/v1/auth/github/callback`
3. Copy the **Client ID** and **Client Secret** into your `.env`:

```
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

### Google OAuth

1. Go to **Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client**
2. Add **Authorised redirect URI**: `http://localhost:8080/api/v1/auth/google/callback`
3. Copy the **Client ID** and **Client Secret** into your `.env`:

```
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

> If OAuth env vars are not set, the login buttons still appear but clicking them returns a "not configured" error. This ensures the app runs gracefully without OAuth credentials.

---

## AI Chat Setup (Optional)

StellarAI uses the [Groq API](https://console.groq.com) to power in-IDE chat assistance for Soroban contract development.

1. Create a free account at [console.groq.com](https://console.groq.com)
2. Generate an API key
3. Set it in your `.env`:

```
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.1-8b-instant
```

The AI chat panel appears in the IDE top bar. If `GROQ_API_KEY` is not set, the chat panel renders but shows a graceful "not configured" message.

---

## API Reference

All endpoints are prefixed with `/api/v1`.

### Public

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/auth/register` | Create account |
| `POST` | `/auth/login` | Login, returns JWT |
| `GET` | `/auth/github` | Start GitHub OAuth flow |
| `GET` | `/auth/github/callback` | GitHub OAuth callback |
| `GET` | `/auth/google` | Start Google OAuth flow |
| `GET` | `/auth/google/callback` | Google OAuth callback |
| `GET` | `/auth/oauth/providers` | Check which OAuth providers are configured |

### Protected (Bearer JWT required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/me` | Current user |
| `GET` | `/projects` | List projects |
| `POST` | `/projects` | Create project |
| `GET` | `/projects/:id` | Get project |
| `PUT` | `/projects/:id` | Update project |
| `DELETE` | `/projects/:id` | Delete project |
| `GET` | `/projects/:id/files` | List project files |
| `POST` | `/projects/:id/files` | Save file content |
| `POST` | `/projects/:id/compile` | Compile project (Soroban WASM pipeline) |
| `POST` | `/projects/:id/test` | Run tests |
| `POST` | `/projects/:id/deploy` | Deploy contract |
| `POST` | `/projects/:id/audit` | Run audit/security checks |
| `POST` | `/ai/chat` | AI chat (Groq API, requires `GROQ_API_KEY`) |

---

## Environment Variables

See `.env.example` and `backend/.env.example` for full documentation. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | JWT signing secret (min 32 chars) |
| `JWT_EXPIRY_HOURS` | — | Token lifetime (default: 24) |
| `PORT` | — | Backend listen port (default: 8080) |
| `GITHUB_CLIENT_ID` | — | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | — | GitHub OAuth client secret |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth client secret |
| `FRONTEND_URL` | — | Frontend base URL for OAuth redirects (default: `http://localhost:5173`) |
| `GROQ_API_KEY` | — | Groq API key for AI chat assistant |
| `GROQ_MODEL` | — | Groq model used by `/api/v1/ai/chat` (default: `llama-3.1-8b-instant`) |
| `VITE_API_URL` | — | Frontend → backend URL (default in Docker Compose: `/api`) |
| `VITE_STELLAR_NETWORK` | — | `TESTNET` or `MAINNET` |
| `VITE_WALLET_PROVIDER` | — | Wallet provider label for IDE (`freighter`) |
| `SOROBAN_EXECUTION_MODE` | — | `docker` or `local` command execution mode |
| `SOROBAN_DOCKER_IMAGE` | — | Docker image used for Soroban command sandbox (default: `stellaride/soroban-sandbox:latest`) |
| `SOROBAN_TIMEOUT_SECONDS` | — | Timeout for Soroban command execution |
| `SOROBAN_SDK_VERSION` | — | Fallback `soroban-sdk` version for generated Cargo.toml |
| `SOROBAN_NETWORK` | — | Soroban deploy target network |
| `SOROBAN_RPC_URL` | — | Soroban RPC endpoint for deploy flow |
| `SOROBAN_CLI_PATH` | — | Soroban CLI executable path |
| `SOROBAN_DEPLOY_SECRET_KEY` | — | Optional backend signer secret for CLI deploy |
| `SOROBAN_AUDIT_COMMAND` | — | Audit command executed in sandbox (default: `cargo scout-audit`) |

---

## Roadmap

| Feature | Status |
|---------|--------|
| Monaco editor | ✅ |
| JWT Auth (register/login) | ✅ |
| Project & file management | ✅ |
| Landing page | ✅ |
| GitHub OAuth login | ✅ |
| Google OAuth login | ✅ |
| AI chat assistant (Groq) | ✅ |
| Compile endpoint (sandbox pipeline) | ✅ |
| Test endpoint (sandbox runner) | ✅ |
| Deploy endpoint (wallet-aware + CLI hook) | ✅ |
| Audit endpoint (static checks + tool hook) | ✅ |
| Developer resources section | ✅ |
| WASM compile pipeline (full) | ✅ |
| Soroban test runner (full) | ✅ |
| Freighter wallet integration | ✅ |
| Stellar network deploy (fully funded wallet + signer) | 🔜 Partial/Config-dependent |
| Real-time collaboration | 🔜 Future |

---

## License

MIT © StellarIDE contributors
