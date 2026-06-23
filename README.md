<div align="center">

<img src="frontend/public/logo.png" alt="StellarIDE" width="80" />

# StellarIDE

**A professional, browser-native smart contract IDE for the Stellar / Soroban ecosystem.**

Write · Compile · Test · Deploy · Audit · Collaborate · Push to GitHub. No local toolchain required.

🌐 **[https://stellaride.dev](https://stellar-ide-ecru.vercel.app)** · 📖 **[User Guide](https://stellar-ide-ecru.vercel.app/docs/guide)**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Rust](https://img.shields.io/badge/Backend-Rust%20%2B%20Axum-orange)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61dafb)](https://react.dev/)

</div>

---

## What is StellarIDE?

StellarIDE is a full-stack, open-source browser IDE built for [Soroban](https://developers.stellar.org/docs/build/smart-contracts) smart contract development on the [Stellar](https://stellar.org) network.

Everything you need in one place:

- **Write** Soroban contracts with Monaco Editor (the VS Code engine)
- **Start fast** with 8 built-in contract templates (token, NFT, voting, escrow, and more)
- **Compile** to WASM directly from the browser
- **Test** with `cargo test` (no local Rust install required)
- **Deploy** to Testnet or Mainnet with a generated wallet or Freighter
- **Audit** contracts with real [Scout](https://github.com/CoinFabrik/scout-soroban) static analysis
- **Fix errors** with AI-powered suggestions in the terminal
- **Ask StellarAI** for help via the built-in chat assistant
- **Collaborate** in real time with live cursors, Yjs CRDT sync, and invite links
- **Manage projects** with settings for rename, collaborators, and delete
- **Sync with GitHub** to import repos, edit, and push commits via the REST API
- **Learn** with step-by-step docs at `/docs/guide`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + Tailwind CSS |
| Editor | Monaco Editor + y-monaco (CRDT collab) |
| Collaboration | Yjs + WebSockets |
| State | Zustand |
| Routing | React Router v7 |
| HTTP Client | Axios |
| Backend | Rust + Axum |
| Database | PostgreSQL (Neon or self-hosted) |
| Auth | JWT + GitHub OAuth + Google OAuth |
| GitHub | REST API import / push (no git CLI) |
| AI | Groq API (chat, fix, explain) |
| Audit | Scout (CoinFabrik) in sandbox |
| ORM | SQLx + auto-migrations |
| Infra | Docker + Docker Compose |
| Wallets | Stellar Wallets Kit (Freighter, xBull, Albedo, and more) |
| Stellar SDK | stellar-sdk (JS) + soroban-sdk (Rust) |

---

## Project Structure

```
StellarIDE/
├── backend/                        # Rust + Axum REST API
│   ├── src/
│   │   ├── handlers/
│   │   │   ├── ai.rs               # AI chat, fix, explain
│   │   │   ├── auth.rs             # Register / login / me
│   │   │   ├── collab.rs           # WebSocket real-time collaboration
│   │   │   ├── collaborators.rs    # Invite links, roles, remove
│   │   │   ├── github.rs           # GitHub import / push API
│   │   │   ├── oauth.rs            # GitHub + Google OAuth
│   │   │   ├── projects.rs         # Projects, files, compile, test, deploy, audit
│   │   │   └── templates.rs        # GET /templates
│   │   ├── services/
│   │   │   ├── soroban.rs          # Compile / test / deploy pipeline
│   │   │   ├── scout_audit.rs      # Scout audit runner
│   │   │   ├── templates.rs        # 8 Soroban contract templates
│   │   │   ├── github.rs           # GitHub REST client
│   │   │   └── collab.rs           # In-memory collab room state
│   │   └── migrations/             # SQLx migrations (auto-run on startup)
│   └── Dockerfile
│
├── frontend/                       # React + Vite SPA
│   ├── src/
│   │   ├── pages/                  # Landing, Dashboard, IDE, ProjectSettings, Docs
│   │   ├── components/             # TemplatePickerModal, AiFixPanel, AuditResultsPanel, etc.
│   │   ├── docs/                   # User guide + technical reference
│   │   ├── features/               # auth, dashboard, ide, collab, github, wallet stores
│   │   └── layouts/                # Public, Auth, Protected, Docs layouts
│   └── Dockerfile
│
├── sandbox/                        # Rust + wasm32 + Stellar CLI + Scout image
├── docker-compose.yml
└── README.md
```

---

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose v2 **OR**
- Rust (for backend) + Node.js 20+ (for frontend)
- A PostgreSQL database ([Neon](https://neon.tech) free tier works well)

---

### Option A: Docker (recommended)

Run everything in containers with one command.

**1. Clone the repo**

```bash
git clone https://github.com/Alouzious/StellarIDE.git
cd StellarIDE
```

**2. Configure environment**

```bash
cp .env.example .env
```

Open `.env` and set at minimum:

```env
JWT_SECRET=your-random-secret-min-32-chars
DATABASE_URL=postgresql://stellaride_user:secure_password@postgres:5432/stellaride

# Execution mode: MUST be local for Docker
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
| User guide | http://localhost:3000/docs/guide |

---

### Option B: Two terminals (local dev)

Fastest way to develop with hot reload on both frontend and backend.

**Terminal 1: Backend**

```bash
cd backend
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET, SOROBAN_EXECUTION_MODE=local

cargo run
# Backend runs on http://localhost:8080
```

**Terminal 2: Frontend**

```bash
cd frontend
cp .env.example .env
# VITE_API_URL=http://localhost:8080

npm install
npm run dev
# Frontend runs on http://localhost:5173
```

> **Note:** When running locally, set `SOROBAN_EXECUTION_MODE=local` in `backend/.env` and install the `stellar` CLI plus `rustup target add wasm32-unknown-unknown`.

---

## Environment Variables

### Root `.env` (Docker)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `SOROBAN_EXECUTION_MODE` | Yes | Must be `local` for Docker |
| `FRONTEND_URL` | Optional | Frontend base URL for OAuth redirects |
| `GROQ_API_KEY` | Optional | Groq API key for AI chat and fix |
| `GROQ_MODEL` | Optional | Groq model (default: `llama-3.1-8b-instant`) |
| `GITHUB_CLIENT_ID` | Optional | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | Optional | GitHub OAuth client secret |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth client secret |
| `SOROBAN_SDK_VERSION` | Optional | soroban-sdk version for generated Cargo.toml |
| `SOROBAN_NETWORK` | Optional | `testnet` or `mainnet` |
| `SOROBAN_CLI_PATH` | Optional | Stellar CLI binary name (default: `stellar`) |

See `.env.example` and `backend/.env.example` for all options.

---

## Features

### Contract templates

Create a new project from 8 ready-to-compile Soroban templates:

| Template | Description |
|---|---|
| Blank Contract | Empty starting point |
| Hello World | Store and return a greeting |
| Token (SEP-41) | Fungible token with mint, burn, transfer |
| NFT | Non-fungible tokens with metadata |
| Voting | On-chain proposals and votes |
| Escrow | Hold funds until conditions are met |
| Multisig | Multi-signature approvals |
| Counter | Simple increment/decrement/reset |

Pick a template from the dashboard **New Project** modal. Files are seeded automatically.

### IDE

- Monaco Editor with Rust syntax highlighting
- Nested file explorer for `src/lib.rs`, `Cargo.toml`, and compiled WASM
- Terminal with streaming compile, test, deploy, and audit output
- **Fix with AI** appears in the terminal when errors are present
- **Explain** opens StellarAI chat with terminal and code context
- **StellarAI chat** panel powered by Groq
- Live collaboration with multi-user editing, live cursors, and presence bar
- **Project settings** for rename, collaborators, invite links, and delete

### Documentation

Two doc sections built into the app:

- **User Guide** (`/docs/guide`): Step-by-step help for new users (first contract, deploy, wallet, FAQ)
- **Technical Reference** (`/docs`): Editor, compile, deploy, API reference, and more

### GitHub integration

- Sign in or connect with GitHub OAuth (`repo` scope)
- **Import from GitHub** to load a repo into the IDE
- **Push to GitHub** with a commit message via REST API (no git CLI)
- Linked projects show repo and branch in the IDE toolbar

### Compile and test

- Compiles Soroban contracts to WASM (`wasm32-unknown-unknown`)
- WASM artifact saved to the project (no recompile needed for deploy)
- `cargo test` with full output streamed to the terminal

### Deploy

- Guided flow: generate wallet or connect Freighter, fund, deploy
- Browser-generated keypair option (secret stays in your tab)
- One-click Testnet funding via Friendbot
- Deploys using saved WASM
- Returns Contract ID with links to Stellar Expert and Stellar Lab
- **Mainnet deploy wizard**: Connect → Review → Deploy flow, pre-deploy checklist, confirmation modal (type DEPLOY)
- **Verify on Stellar Expert**: compares local WASM SHA256 with on-chain bytecode via `stellar contract fetch`
- Links to Stellar Expert and Stellar Lab; GitHub-linked projects get guidance for full source validation via soroban-build-workflow

### Audit

- Real [Scout](https://github.com/CoinFabrik/scout-soroban) static analysis in the sandbox
- Streaming progress in the terminal
- Audit Results panel with severity filters and jump-to-line
- **Fix with AI** can address Scout findings

### Auth and collaboration

- Email/password registration and login
- GitHub and Google OAuth
- JWT with configurable expiry
- WebSocket rooms per project with Yjs CRDT editing
- Role-based access: **owner**, **editor**, **viewer** (read-only)
- Invite links with editor or viewer roles
- Manage collaborators from **Project Settings**

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
2. Create OAuth 2.0 Client ID with redirect URI: `http://localhost:8080/api/v1/auth/google/callback`
3. Add to `.env`:

```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

---

## AI Setup

StellarIDE uses [Groq](https://console.groq.com) for StellarAI chat and AI Fix.

```env
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.1-8b-instant
```

| Feature | Where it lives |
|---|---|
| StellarAI chat | IDE toolbar **AI Chat** button |
| Explain errors | Terminal **Explain** button (opens chat with context) |
| Fix with AI | Terminal **Fix with AI** button (when errors exist) |

If `GROQ_API_KEY` is not set, AI features show a clear unavailable message.

---

## API Reference

All REST endpoints are prefixed with `/api/v1`. Full reference: `/docs/api`.

### Highlights

| Method | Path | Description |
|---|---|---|
| GET | `/templates` | List contract templates |
| POST | `/projects` | Create project (optional `template_id`) |
| PUT | `/projects/:id` | Update project name/description |
| DELETE | `/projects/:id` | Delete project |
| POST | `/projects/:id/compile` | Compile to WASM (SSE stream available) |
| POST | `/projects/:id/test` | Run tests |
| POST | `/projects/:id/deploy` | Deploy contract |
| POST | `/projects/:id/audit` | Run Scout audit |
| POST | `/projects/:id/ai-fix` | AI fix proposal |
| POST | `/projects/:id/ai-explain` | AI contract explanation |
| POST | `/projects/:id/ai/chat` | Project-scoped AI chat |
| POST | `/projects/:id/collaborators/invite` | Generate invite link |
| PUT | `/projects/:id/collaborators/:user_id` | Update collaborator role |
| DELETE | `/projects/:id/collaborators/:user_id` | Remove collaborator |

### WebSocket

| Path | Description |
|---|---|
| `GET /collab/:project_id?token=&file=` | Per-file Yjs doc + awareness sync |
| `GET /collab/:project_id/project?token=` | File tree, terminal, deploy lock, audit sync |

---

## Contributing

Contributions are welcome.

```bash
git clone https://github.com/Alouzious/StellarIDE.git
git checkout -b feat/your-feature
# make changes
git commit -m "feat: add your feature"
git push origin feat/your-feature
```

Open a Pull Request on GitHub. For large changes, open an issue first so we can discuss the approach.

**Ideas for contributors:**

- Additional contract templates
- Test coverage improvements
- Documentation translations

---

## Roadmap

| Feature | Status |
|---|---|
| Monaco editor | Done |
| JWT auth (register/login) | Done |
| GitHub + Google OAuth | Done |
| Project and file management | Done |
| Contract templates library (8 templates) | Done |
| Compile, test, deploy | Done |
| Freighter / Wallets Kit signing | Done |
| Scout audit integration | Done |
| AI chat (Groq) | Done |
| AI fix + explain | Done |
| GitHub import and push | Done |
| Real-time collaboration | Done |
| Project settings page | Done |
| User guide docs (`/docs/guide`) | Done |
| Technical docs (`/docs`) | Done |
| Mainnet deploy wizard improvements | Done |
| Contract verification on Stellar Expert | Done |

---

## License

MIT © StellarIDE contributors

---

<div align="center">

Built with care for the Stellar ecosystem

[Website](https://stellar-ide-ecru.vercel.app) · [User Guide](https://stellar-ide-ecru.vercel.app/docs/guide) · [GitHub](https://github.com/Alouzious/StellarIDE)

</div>
