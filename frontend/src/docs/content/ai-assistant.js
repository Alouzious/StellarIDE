export default {
  title: 'AI Assistant',
  description: 'Groq-powered chat, contract explanations, and AI-assisted fixes in StellarIDE.',
  editFile: 'ai-assistant.js',
  sections: [
    {
      id: 'setup',
      title: 'Setup',
      body: `Set \`GROQ_API_KEY\` on the backend. Optional \`GROQ_MODEL\` defaults to \`llama-3.1-8b-instant\`.

Without the key, AI buttons show a clear error.`,
    },
    {
      id: 'chat',
      title: 'AI Chat panel',
      body: `Open **AI Chat** from the IDE header. Messages go to:

\`\`\`http
POST /api/v1/projects/:id/ai/chat
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "How do I use require_auth?" }
  ]
}
\`\`\`

Viewers can chat but cannot request code edits through chat.`,
    },
    {
      id: 'explain',
      title: 'Explain',
      body: `**Explain** (Ctrl+Shift+E) analyzes the current file and project context:

- Contract overview and function breakdown
- Security considerations
- Soroban SDK usage
- Compiler errors from the terminal, if any

Results appear in a dedicated markdown panel with copy and retry.`,
    },
    {
      id: 'fix',
      title: 'Fix with AI',
      body: `**Fix with AI** (Ctrl+Shift+F) sends errors, terminal output, audit findings, and all project files to:

\`\`\`http
POST /api/v1/projects/:id/ai-fix
\`\`\`

The response includes per-file diffs with confidence level. Review changes, select files, click **Apply Fix**, and StellarIDE recompiles automatically.`,
    },
    {
      id: 'context',
      title: 'Context sent to AI',
      body: `Both Fix and Explain include:

- Full active file and all project files
- Terminal output and error lines
- Scout audit findings when available
- Network (testnet/mainnet) and Soroban SDK version from \`Cargo.toml\``,
    },
  ],
}
