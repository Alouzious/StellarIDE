export default {
  title: 'Overview',
  description: 'StellarIDE is a browser-native IDE for writing, compiling, testing, deploying, and auditing Soroban smart contracts on Stellar.',
  editFile: 'overview.js',
  sections: [
    {
      id: 'what-is-stellaride',
      title: 'What is StellarIDE?',
      body: `StellarIDE is an open-source IDE for [Soroban](https://developers.stellar.org/docs/build/smart-contracts) smart contract development on the [Stellar](https://stellar.org) network.

You can write Rust contracts in Monaco Editor, compile to WASM, run \`cargo test\`, deploy to Testnet or Mainnet, audit with Scout, collaborate in real time, and sync with GitHub. All from the browser.`,
    },
    {
      id: 'core-features',
      title: 'Core features',
      body: `- **Editor**: Monaco with Rust syntax highlighting and real-time collaboration
- **Compile / Test / Deploy**: Run Soroban toolchain commands from the IDE terminal
- **Audit**: Scout static analysis with structured findings
- **Wallet**: Connect Freighter or use a generated in-browser wallet
- **GitHub**: Import repos, push commits, open pull requests
- **AI**: Chat, explain contract code, and propose fixes via Groq`,
    },
    {
      id: 'architecture',
      title: 'Architecture',
      body: `StellarIDE has a React frontend and a Rust (Axum) backend backed by PostgreSQL.

Contract commands run in a sandbox environment (Docker locally, or directly on the backend host on Render). The frontend talks to the API at \`/api/v1\` and opens WebSocket connections at \`/collab/:project_id\` for file sync and presence.`,
    },
    {
      id: 'requirements',
      title: 'Requirements',
      body: `To self-host StellarIDE you need:

- Node.js 18+ and Rust (for development)
- PostgreSQL database
- Docker (recommended for compile/test/deploy/audit sandbox)
- Optional: \`GROQ_API_KEY\` for AI features
- Optional: GitHub and Google OAuth credentials

See [Getting Started](/docs/getting-started) for setup steps.`,
    },
  ],
}
