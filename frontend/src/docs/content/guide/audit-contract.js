export default {
  title: 'Running your first audit',
  description: 'Use Scout to find security issues before you deploy.',
  editFile: 'guide/audit-contract.js',
  sections: [
    {
      id: 'why-audit',
      title: 'Why audit?',
      body: `Scout scans your Rust code for common Soroban security issues: missing authorization, unsafe patterns, arithmetic risks, and more.`,
    },
    {
      id: 'run',
      title: 'Run an audit',
      body: `Click **Audit** in the IDE toolbar. Progress appears in the terminal.

When finished, the **Audit Results** panel opens with severity counts and individual findings.`,
    },
    {
      id: 'findings',
      title: 'Reading findings',
      body: `Each card shows severity, file location, code snippet, and a recommendation.

Click a finding to jump to that line in the editor. Filter by severity with the toggle buttons.`,
    },
    {
      id: 'fix',
      title: 'Fix issues',
      body: `Use **Fix with AI** to generate patches for reported problems. Review the diff, apply selected fixes, and recompile.

Re-run **Audit** until you get a clean result or only acceptable warnings.`,
    },
  ],
}
