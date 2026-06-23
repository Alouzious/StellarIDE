export default {
  title: 'API Reference',
  description: 'REST and WebSocket endpoints for the StellarIDE backend.',
  editFile: 'api.js',
  sections: [
    {
      id: 'base-url',
      title: 'Base URL',
      body: `All REST routes are under:

\`\`\`
/api/v1
\`\`\`

WebSockets:

\`\`\`
/collab/:project_id
/collab/:project_id/project
\`\`\`

Send \`Authorization: Bearer <jwt>\` on protected routes. WebSockets pass \`token\` as a query parameter.`,
    },
    {
      id: 'auth',
      title: 'Authentication',
      body: `\`\`\`http
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
GET  /api/v1/auth/github
GET  /api/v1/auth/google
GET  /api/v1/auth/oauth/providers
\`\`\``,
    },
    {
      id: 'projects',
      title: 'Projects and files',
      body: `\`\`\`http
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:id
PUT    /api/v1/projects/:id
DELETE /api/v1/projects/:id
GET    /api/v1/projects/:id/files
POST   /api/v1/projects/:id/files
\`\`\``,
    },
    {
      id: 'toolchain',
      title: 'Compile, test, deploy, audit',
      body: `\`\`\`http
POST /api/v1/projects/:id/compile
POST /api/v1/projects/:id/compile/stream
POST /api/v1/projects/:id/test
POST /api/v1/projects/:id/test/stream
POST /api/v1/projects/:id/deploy
POST /api/v1/projects/:id/deploy/stream
POST /api/v1/projects/:id/audit
POST /api/v1/projects/:id/audit/stream
\`\`\`

Stream endpoints return \`text/event-stream\` with line-delimited output. Lines ending in \`[DONE]\` or \`[ERROR]\` mark completion.`,
    },
    {
      id: 'ai',
      title: 'AI',
      body: `\`\`\`http
POST /api/v1/ai/chat
POST /api/v1/projects/:id/ai/chat
POST /api/v1/projects/:id/ai-fix
POST /api/v1/projects/:id/ai-explain
\`\`\``,
    },
    {
      id: 'github',
      title: 'GitHub',
      body: `\`\`\`http
GET  /api/v1/github/status
GET  /api/v1/github/repos
POST /api/v1/github/import
POST /api/v1/projects/:id/github/link
GET  /api/v1/projects/:id/github/diff
POST /api/v1/projects/:id/github/push
GET  /api/v1/projects/:id/github/pushes
\`\`\``,
    },
    {
      id: 'collaborators',
      title: 'Collaborators',
      body: `\`\`\`http
GET  /api/v1/projects/:id/collaborators
POST /api/v1/projects/:id/collaborators/invite
POST /api/v1/projects/:id/collaborators/join
GET  /api/v1/projects/:id/collaborators/me
\`\`\``,
    },
    {
      id: 'health',
      title: 'Health',
      body: `\`\`\`http
GET /api/v1/health
\`\`\`

Returns \`200 OK\` when the backend is running.`,
    },
  ],
}
