export default {
  title: 'Compile and Test',
  description: 'Build Soroban WASM contracts and run cargo test from the IDE terminal.',
  editFile: 'compile-test.js',
  sections: [
    {
      id: 'compile',
      title: 'Compile',
      body: `Click **Compile** in the IDE toolbar. StellarIDE:

1. Writes your project files to a temporary Cargo workspace
2. Runs \`cargo build --target wasm32-unknown-unknown --release\`
3. Streams stdout/stderr to the terminal via SSE
4. Saves the resulting \`.wasm\` file to your project on success

Streaming endpoint:

\`\`\`http
POST /api/v1/projects/:id/compile/stream
Authorization: Bearer <token>
\`\`\`

Non-streaming JSON endpoint also exists at \`POST /projects/:id/compile\`.`,
    },
    {
      id: 'test',
      title: 'Test',
      body: `Click **Test** to run:

\`\`\`bash
cargo test
\`\`\`

Test output streams to the terminal. Soroban unit tests use \`soroban-sdk\` testutils in \`#[cfg(test)]\` modules.

Streaming endpoint:

\`\`\`http
POST /api/v1/projects/:id/test/stream
\`\`\``,
    },
    {
      id: 'execution-modes',
      title: 'Execution modes',
      body: `Set \`SOROBAN_EXECUTION_MODE\` on the backend:

- \`docker\` (default): commands run inside the sandbox Docker image
- \`local\`: commands run directly on the backend host (used on Render with tools pre-installed)

Timeout is controlled by \`SOROBAN_TIMEOUT_SECONDS\` (default 180).`,
    },
    {
      id: 'errors',
      title: 'Handling errors',
      body: `Compiler errors appear in the terminal with red styling. Use **Fix with AI** (Ctrl+Shift+F) to get a proposed patch, or **Explain** (Ctrl+Shift+E) for a contract walkthrough that includes error context.

See [AI Assistant](/docs/ai-assistant) for details.`,
    },
  ],
}
