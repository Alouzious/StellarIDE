export default {
  title: 'Contract Auditing',
  description: 'Run Scout static analysis on Soroban contracts and review structured findings.',
  editFile: 'audit.js',
  sections: [
    {
      id: 'scout',
      title: 'Scout analyzer',
      body: `StellarIDE runs [Scout](https://github.com/CoinFabrik/scout-soroban) (CoinFabrik) via:

\`\`\`bash
cargo scout-audit --output-format json
\`\`\`

Scout checks for Soroban-specific issues including missing authorization, arithmetic problems, unsafe unwrap/expect, storage misuse, and more.`,
    },
    {
      id: 'run-audit',
      title: 'Run an audit',
      body: `Click **Audit** in the IDE. Output streams via:

\`\`\`http
POST /api/v1/projects/:id/audit/stream
Authorization: Bearer <token>
\`\`\`

Progress lines appear in the terminal. Each finding is sent as a \`[FINDING]\` SSE line with JSON payload.`,
    },
    {
      id: 'results-panel',
      title: 'Audit Results panel',
      body: `After the audit completes, the Audit Results panel opens with:

- Severity summary (Critical, High, Medium, Low)
- Overall risk level
- Filterable finding cards with code snippets and recommendations
- Click a finding to highlight the line in the editor
- Export findings as JSON`,
    },
    {
      id: 'collab',
      title: 'Collaboration',
      body: `Audit results broadcast to all connected users via \`audit_complete\` WebSocket messages. Everyone sees the same findings panel update.`,
    },
    {
      id: 'timeout',
      title: 'Timeouts and first run',
      body: `Audits respect \`SOROBAN_TIMEOUT_SECONDS\` (default 180 seconds). The backend Docker image pre-warms Scout detectors during build so typical runs finish in seconds after deploy.`,
    },
  ],
}
