export default {
  title: 'The Editor',
  description: 'Monaco editor, file management, saving, and collaborative editing in StellarIDE.',
  editFile: 'editor.js',
  sections: [
    {
      id: 'monaco',
      title: 'Monaco editor',
      body: `StellarIDE uses [@monaco-editor/react](https://github.com/superiorfx/monaco-editor-react) with Rust language support.

Features include line numbers, word wrap, syntax highlighting, and read-only mode for viewers.`,
    },
    {
      id: 'files',
      title: 'File explorer',
      body: `Projects store files in PostgreSQL via the API. Supported paths include:

- \`src/lib.rs\` and other \`.rs\` files
- \`Cargo.toml\`
- Compiled \`.wasm\` artifacts (read-only after compile)

Create, rename, and delete files from the nested file tree. Changes sync to collaborators in real time.`,
    },
    {
      id: 'saving',
      title: 'Saving',
      body: `Click **Save** or rely on debounced auto-save while typing.

Files are persisted with:

\`\`\`http
POST /api/v1/projects/:id/files
Content-Type: application/json
Authorization: Bearer <token>

{
  "file_path": "src/lib.rs",
  "content": "...",
  "language": "rust"
}
\`\`\``,
    },
    {
      id: 'collab-editing',
      title: 'Collaborative editing',
      body: `When multiple editors are connected, file content syncs through Yjs CRDT over WebSocket (\`/collab/:project_id\`).

Each user sees colored cursors and selections. Viewers can read but not edit.`,
    },
    {
      id: 'audit-highlights',
      title: 'Audit finding highlights',
      body: `Click a finding in the Audit Results panel to jump to the relevant line. The editor highlights the line range until you navigate away.`,
    },
  ],
}
