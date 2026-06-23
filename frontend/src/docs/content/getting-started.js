export default {
  title: 'Getting Started',
  description: 'Create an account, start a project, and run your first Soroban compile in StellarIDE.',
  editFile: 'getting-started.js',
  sections: [
    {
      id: 'create-account',
      title: 'Create an account',
      body: `1. Go to [Register](/register) or sign in with GitHub/Google OAuth
2. After login you land on the [Dashboard](/dashboard)
3. Click **New Project** and give your contract a name

Each new project includes \`src/lib.rs\` and a \`Cargo.toml\` preconfigured with the Soroban SDK.`,
    },
    {
      id: 'open-ide',
      title: 'Open the IDE',
      body: `Click a project card to open \`/ide/:id\`.

The IDE layout:

- **Left**: file explorer with nested folders
- **Center**: Monaco editor (collaborative when others join)
- **Bottom**: terminal for compile, test, deploy, and audit output
- **Top bar**: Save, Compile, Test, Deploy, Audit, Explain, Fix, and Share`,
    },
    {
      id: 'first-compile',
      title: 'First compile',
      body: `Open \`src/lib.rs\`, then click **Compile**.

The terminal streams output from:

\`\`\`bash
cargo build --target wasm32-unknown-unknown --release
\`\`\`

On success, a \`.wasm\` artifact is saved to your project files and is ready to deploy.`,
    },
    {
      id: 'environment',
      title: 'Self-hosting environment variables',
      body: `Copy \`.env.example\` to \`.env\` in the repo root and backend folder. Key variables:

\`\`\`bash
DATABASE_URL=postgres://...
JWT_SECRET=your-secret
SOROBAN_EXECUTION_MODE=docker   # or local
SOROBAN_DOCKER_IMAGE=stellaride/soroban-sandbox:latest
GROQ_API_KEY=                   # optional, for AI
\`\`\`

Build the sandbox image:

\`\`\`bash
docker build -t stellaride/soroban-sandbox ./sandbox
\`\`\``,
    },
  ],
}
