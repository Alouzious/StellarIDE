export default {
  title: 'GitHub Integration',
  description: 'Import repositories, link projects, preview diffs, and push commits from StellarIDE.',
  editFile: 'github.js',
  sections: [
    {
      id: 'connect',
      title: 'Connect GitHub',
      body: `Sign in with GitHub OAuth or connect GitHub from the dashboard. StellarIDE stores an OAuth token to call the GitHub REST API.

Check connection status:

\`\`\`http
GET /api/v1/github/status
Authorization: Bearer <token>
\`\`\``,
    },
    {
      id: 'import',
      title: 'Import a repository',
      body: `From the dashboard, use **Import from GitHub** to clone contract files into a new StellarIDE project.

The importer detects \`Cargo.toml\` and common Soroban folder layouts. You can pick a subfolder for monorepos.`,
    },
    {
      id: 'link',
      title: 'Link an existing project',
      body: `Inside the IDE, use **Link GitHub** to associate a project with \`owner/repo\` and branch.

Linked projects show a push bar with commit message input and diff preview before push.`,
    },
    {
      id: 'push',
      title: 'Push changes',
      body: `Push creates a commit on the linked branch via the GitHub API (no local git required):

\`\`\`http
POST /api/v1/projects/:id/github/push
Content-Type: application/json

{
  "message": "Update contract",
  "branch": "main",
  "open_pr": false
}
\`\`\`

Preview changes first:

\`\`\`http
GET /api/v1/projects/:id/github/diff
\`\`\``,
    },
  ],
}
