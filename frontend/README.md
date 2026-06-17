# StellarIDE Frontend

React + Vite SPA for the StellarIDE browser IDE.

## Stack

- **React 19** + **Vite 8**
- **Tailwind CSS** — Stellar-themed design system
- **Monaco Editor** — `@monaco-editor/react`
- **Yjs + y-monaco** — real-time collaborative editing
- **Zustand** — auth, IDE, dashboard, GitHub, and collab state
- **Axios** — REST API client

## Key features (UI)

| Feature | Where |
|---------|--------|
| Landing page | `src/pages/LandingPage.jsx` + `src/features/landing/` |
| Auth (email + OAuth) | `LoginPage`, `RegisterPage`, `OAuthCallbackPage` |
| Project dashboard | `DashboardPage` + **Import from GitHub** |
| IDE | `IdePage` — compile, test, deploy, audit, AI chat |
| GitHub push bar | Linked projects — commit message + push |
| Live collaboration | `CollabEditor`, `PresenceBar`, **Share** modal |
| Invite links | `/ide/:id?invite=token` |

## Development

```bash
cp .env.example .env
# VITE_API_URL=http://localhost:8080

npm install
npm run dev
# → http://localhost:5173
```

## Environment

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend base URL (default `http://localhost:8080`) |

WebSocket collab uses the same host with `ws://` — see `getWsBaseUrl()` in `src/services/api.js`.

## Build

```bash
npm run build
npm run preview
```

Production builds are served via `nginx.conf` in Docker (port 3000).
