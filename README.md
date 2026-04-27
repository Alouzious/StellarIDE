<div align="center">

<img src="frontend/public/logo.png" alt="StellarIDE" width="80" />

# StellarIDE

**A professional, browser-native smart contract IDE for the Stellar / Soroban ecosystem.**

Write · Compile · Test · Deploy — no local toolchain required.

🌐 **[stellar-ide-ecru.vercel.app](https://stellar-ide-ecru.vercel.app)**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Rust](https://img.shields.io/badge/Backend-Rust%20%2B%20Axum-orange)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61dafb)](https://react.dev/)

</div>

---

## What is StellarIDE?

StellarIDE is a full-stack, open-source browser IDE built specifically for [Soroban](https://developers.stellar.org/docs/build/smart-contracts) smart contract development on the [Stellar](https://stellar.org) network.

It gives developers everything they need in one place:

- **Write** Soroban contracts with Monaco Editor (the VS Code engine)
- **Compile** to WASM directly from the browser
- **Test** with `cargo test` — no local Rust needed
- **Deploy** to Testnet or Mainnet with a generated or connected wallet
- **Audit** contracts with static analysis
- **Chat** with an AI assistant that understands Soroban

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Editor | Monaco Editor |
| State | Zustand |
| Routing | React Router v7 |
| HTTP Client | Axios |
| Backend | Rust + Axum |
| Database | PostgreSQL (Neon or self-hosted) |
| Auth | JWT + GitHub OAuth + Google OAuth |
| AI Chat | Groq API |
| ORM | SQLx + auto-migrations |
| Infra | Docker + Docker Compose |
| Stellar SDK | stellar-sdk (JS) + soroban-sdk (Rust) |

---

## Project Structure

```
StellarIDE/
├── backend/                        # Rust + Axum REST API
│   ├── src/
│   │   ├── main.rs                 # Entry point
│   │   ├── config.rs               # Environment config
│   │   ├── errors.rs               # Unified error types
│   │   ├── db/mod.rs               # PgPool setup
│   │   ├── handlers/
│   │   │   ├── ai.rs               # AI chat + fix + explain
│   │   │   ├── auth.rs             # Register / login / me
│   │   │   ├── health.rs           # Health check
│   │   │   ├── oauth.rs            # GitHub + Google OAuth
│   │   │   └── projects.rs         # Projects + files + compile + test + deploy + audit
│   │   ├── middleware/auth.rs      # JWT guard
│   │   ├── models/                 # user, project, project_file
│   │   ├── routes/mod.rs           # Router builder
│   │   └── services/soroban.rs     # Compile / test / deploy / audit pipeline
│   ├── migrations/                 # SQLx SQL migrations (auto-run on startup)
│   ├── Cargo.toml
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/                       # React + Vite SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── Footer.jsx
│   │   │   └── ui/                 # Button, Input, Card, Modal, Toast, ChatPanel
│   │   ├── features/
│   │   │   ├── auth/authStore.js   # Login, register, OAuth, JWT persistence
│   │   │   ├── dashboard/          # Project management store
│   │   │   ├── ide/
│   │   │   │   ├── ideStore.js     # Editor, files, compile/test/deploy/audit, wallet
│   │   │   │   └── chatStore.js    # AI chat state
│   │   │   └── landing/            # Landing page sections
│   │   ├── layouts/                # PublicLayout, AuthLayout, ProtectedLayout
│   │   ├── pages/                  # Landing, Login, Register, Dashboard, IDE, OAuth, 404
│   │   ├── hooks/useToast.js
│   │   └── services/api.js         # Axios instance
│   ├── Dockerfile
│   ├── nginx.conf
│   └── .env.example
│
├── sandbox/
│   └── Dockerfile                  # Rust + wasm32 + Stellar CLI sandbox image
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose v2 **OR**
- Rust (for backend) + Node.js 20+ (for frontend)
- A PostgreSQL database — [Neon](https://neon.tech) free tier works great

---

### Option A — Docker (recommended)

This runs everything in containers with one command.

**1. Clone the repo**

```bash
git clone https://github.com/YOUR_USERNAME/StellarIDE.git
cd StellarIDE
```

**2. Configure environment**

```bash
cp .env.example .env
```

Open `.env` and set at minimum:

```env
JWT_SECRET=your-random-secret-min-32-chars
DATABASE_URL=postgresql://user:password@host/stellaride?sslmode=require

# Execution mode — MUST be local for Docker
SOROBAN_EXECUTION_MODE=local

# Optional but recommended
GROQ_API_KEY=gsk_...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

**3. Start all services**

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080 |
| Health check | http://localhost:8080/api/v1/health |

---

### Option B — Two Terminals (local dev)

This is the fastest way to develop — hot reload on both frontend and backend.

**Terminal 1 — Backend**

```bash
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, SOROBAN_EXECUTION_MODE=local

cargo run
# Backend runs on http://localhost:8080
```

**Terminal 2 — Frontend**

```bash
cd frontend
cp .env.example .env
# VITE_API_URL=http://localhost:8080

npm install
npm run dev
# Frontend runs on http://localhost:5173
```

> **Note:** When running locally, make sure `SOROBAN_EXECUTION_MODE=local` in `backend/.env` and that you have `stellar` CLI and `rustup` with `wasm32-unknown-unknown` target installed.

---

## Environment Variables

### Root `.env` (Docker only)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | JWT signing secret (min 32 chars) |
| `SOROBAN_EXECUTION_MODE` | ✅ | Must be `local` for Docker |
| `FRONTEND_URL` | — | Frontend base URL for OAuth redirects |
| `GROQ_API_KEY` | — | Groq API key for AI chat |
| `GITHUB_CLIENT_ID` | — | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | — | GitHub OAuth client secret |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth client secret |
| `SOROBAN_SDK_VERSION` | — | soroban-sdk version for generated Cargo.toml |
| `SOROBAN_NETWORK` | — | `testnet` or `mainnet` |
| `SOROBAN_CLI_PATH` | — | stellar CLI binary name (default: `stellar`) |

See `.env.example` and `backend/.env.example` for all options.

---

## Features

### IDE
- Monaco Editor with Rust syntax highlighting
- File explorer — edit `src/lib.rs`, `Cargo.toml`, and view compiled WASM
- Output panel with real-time compile/test/deploy logs
- AI Chat panel — powered by Groq, understands Soroban contracts

### Compile
- Compiles Soroban contracts to WASM (`wasm32-unknown-unknown`)
- WASM artifact saved to project — no recompile needed for deploy
- Cargo.toml editable from the browser

### Test
- Runs `cargo test` with `testutils` feature enabled
- Full output streamed to the IDE output panel

### Deploy
- 3-step guided flow: Generate Wallet → Fund → Deploy
- Generates Stellar keypair in the browser (secret key never leaves the tab)
- One-click Testnet funding via Friendbot
- Deploys using saved WASM — no recompile
- Returns Contract ID with links to Stellar Expert and Stellar Lab

### Auth
- Email/password registration and login
- GitHub OAuth
- Google OAuth
- JWT with configurable expiry

---

## OAuth Setup

### GitHub
1. Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Set callback URL: `http://localhost:8080/api/v1/auth/github/callback`
3. Add to `.env`:
```env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

### Google
1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID → set redirect URI: `http://localhost:8080/api/v1/auth/google/callback`
3. Add to `.env`:
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

---

## AI Chat Setup

StellarAI uses [Groq](https://console.groq.com) for fast inference.

```env
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.1-8b-instant
```

If not configured, the chat panel renders but shows a graceful unavailable message.

---

## API Reference

All endpoints are prefixed with `/api/v1`.

### Public

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login, returns JWT |
| GET | `/auth/github` | Start GitHub OAuth |
| GET | `/auth/github/callback` | GitHub OAuth callback |
| GET | `/auth/google` | Start Google OAuth |
| GET | `/auth/google/callback` | Google OAuth callback |
| GET | `/auth/oauth/providers` | Which OAuth providers are configured |

### Protected (Bearer JWT required)

| Method | Path | Description |
|---|---|---|
| GET | `/auth/me` | Current user |
| GET | `/projects` | List projects |
| POST | `/projects` | Create project |
| GET | `/projects/:id` | Get project |
| PUT | `/projects/:id` | Update project |
| DELETE | `/projects/:id` | Delete project |
| GET | `/projects/:id/files` | List project files |
| POST | `/projects/:id/files` | Save file |
| POST | `/projects/:id/compile` | Compile to WASM |
| POST | `/projects/:id/test` | Run tests |
| POST | `/projects/:id/deploy` | Deploy contract |
| POST | `/projects/:id/audit` | Run audit checks |
| POST | `/ai/chat` | AI chat |

---

## Contributing

Contributions are welcome and appreciated.

```bash
# 1. Fork the repo
# 2. Create your feature branch
git checkout -b feat/your-feature

# 3. Make your changes and commit
git commit -m "feat: add your feature"

# 4. Push and open a Pull Request
git push origin feat/your-feature
```

**Good first issues:**
- Freighter wallet signing (replace raw secret key flow)
- Real-time collaboration (WebSocket)
- More contract templates
- Audit tooling integration (Scout)
- Test coverage improvements

Please open an issue before starting large changes so we can discuss the approach.

---

## Roadmap

| Feature | Status |
|---|---|
| Monaco editor | ✅ |
| JWT Auth (register/login) | ✅ |
| GitHub OAuth | ✅ |
| Google OAuth | ✅ |
| Project & file management | ✅ |
| Cargo.toml editing from browser | ✅ |
| Compile to WASM | ✅ |
| Run tests | ✅ |
| Deploy (generated wallet + Friendbot) | ✅ |
| WASM saved to DB — no recompile on deploy | ✅ |
| AI chat assistant (Groq) | ✅ |
| AI markdown rendering with syntax highlighting | ✅ |
| Static audit checks | ✅ |
| Freighter wallet signing | 🔜 |
| Real-time collaboration | 🔜 |
| Contract templates library | 🔜 |
| Scout audit integration | 🔜 |
| Mainnet deploy | 🔜 |

---

## License

MIT © StellarIDE contributors

---

<div align="center">
Built with ❤️ for the Stellar ecosystem
</div>
