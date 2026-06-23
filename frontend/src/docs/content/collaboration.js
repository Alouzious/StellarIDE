export default {
  title: 'Real-time Collaboration',
  description: 'Invite teammates, sync files, and edit contracts together in StellarIDE.',
  editFile: 'collaboration.js',
  sections: [
    {
      id: 'roles',
      title: 'Roles',
      body: `Each project member has a role:

- **Owner / Editor**: can edit files, compile, deploy, and push
- **Viewer**: read-only editor and terminal

Role is enforced on the API and in the IDE UI.`,
    },
    {
      id: 'invites',
      title: 'Invite links',
      body: `Click **Share** in the IDE to create an invite link with editor or viewer access.

\`\`\`http
POST /api/v1/projects/:id/collaborators/invite
Content-Type: application/json

{ "role": "editor" }
\`\`\`

Recipients open the link, join the project, and appear in the presence bar.`,
    },
    {
      id: 'websockets',
      title: 'WebSocket channels',
      body: `Two WebSocket endpoints per project:

- \`/collab/:project_id\` — Yjs document sync for each open file
- \`/collab/:project_id/project\` — file tree updates, terminal output, deploy lock, audit results

Authenticate with \`?token=<jwt>&conn_id=<uuid>\`.`,
    },
    {
      id: 'presence',
      title: 'Presence and cursors',
      body: `The presence bar shows connected users with color-coded avatars. Monaco displays remote cursors via Yjs awareness.

File tree changes (create, rename, delete) broadcast to all connected clients.`,
    },
    {
      id: 'terminal-sync',
      title: 'Shared terminal output',
      body: `When one user compiles, tests, deploys, or audits, collaborators see the same streaming terminal output and final results (including audit findings panels).`,
    },
  ],
}
