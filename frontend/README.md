# StellarIDE Frontend

React + Vite SPA for the StellarIDE browser IDE.

## Stack

- **React 19** + **Vite 8**
- **Tailwind CSS** (Stellar-themed design system)
- **Monaco Editor** via `@monaco-editor/react`
- **Yjs + y-monaco** for real-time collaborative editing
- **Zustand** for auth, IDE, dashboard, GitHub, collab, and wallet state
- **Axios** REST API client

## Key features (UI)

| Feature | Where |
|---------|--------|
| Landing page | `src/pages/LandingPage.jsx` + `src/features/landing/` |
| Docs site | `src/docs/` + `src/layouts/DocsLayout.jsx` |
| Auth (email + OAuth) | `LoginPage`, `RegisterPage`, `OAuthCallbackPage` |
| Project dashboard | `DashboardPage` + template picker + GitHub import |
| Project settings | `ProjectSettingsPage` (rename, collaborators, delete) |
| IDE | `IdePage` (compile, test, deploy, audit, AI chat, terminal fix/explain) |
| GitHub push | `PushModal`, `LinkGitHubModal`, toolbar push bar |
| Live collaboration | `CollabEditor`, `PresenceBar`, invite links |
| Audit results | `AuditResultsPanel` + Scout streaming in terminal |
| AI fix | `AiFixPanel` (triggered from terminal on errors) |

## Development

```bash
cp .env.example .env
# VITE_API_URL=http://localhost:8080

npm install
npm run dev
# http://localhost:5173
```

## Environment

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend base URL (default `http://localhost:8080`) |

WebSocket collab uses the same host with `ws://`. See `getWsBaseUrl()` in `src/services/api.js`.

## Build

```bash
npm run build
npm run preview
```

Production builds are served via `nginx.conf` in Docker (port 3000).

See the [root README](../README.md) for full project setup.
