export default {
  title: 'How to use the editor',
  description: 'Navigate files, save changes, and use the IDE toolbar.',
  editFile: 'guide/using-editor.js',
  sections: [
    {
      id: 'layout',
      title: 'IDE layout',
      body: `- **Left**: file explorer
- **Center**: code editor
- **Bottom**: terminal (compile, test, deploy, audit output)
- **Top**: Save, Compile, Test, Deploy, Audit, Explain, Fix, Share`,
    },
    {
      id: 'files',
      title: 'Working with files',
      body: `Click a file to open it. Changes auto-save after you pause typing, or click **Save** manually.

Create folders and files from the explorer menu. Renames sync to collaborators instantly.`,
    },
    {
      id: 'terminal',
      title: 'Terminal panel',
      body: `Run actions from the toolbar and watch live output in the terminal.

Use **Clear** to reset the log. Toggle auto-scroll if you want to read earlier lines while a command runs.`,
    },
    {
      id: 'ai-tools',
      title: 'Explain and Fix',
      body: `**Explain** opens a guide to your current contract.

**Fix with AI** proposes code changes when compile or audit errors appear. Review the diff before applying.`,
    },
  ],
}
