export default {
  title: 'Inviting teammates',
  description: 'Share a project and collaborate in real time.',
  editFile: 'guide/invite-team.js',
  sections: [
    {
      id: 'share',
      title: 'Open project settings',
      body: `On the dashboard, open a project card menu and choose **Settings**, or click **Settings** in the IDE toolbar.

Generate an invite link with **Editor** (can edit) or **Viewer** (read-only) access. Change roles or remove collaborators from the settings page.`,
    },
    {
      id: 'invite-link',
      title: 'Copy the invite link',
      body: `StellarIDE generates a link. Send it to your teammate.

When they open it while logged in, they join the project automatically.`,
    },
    {
      id: 'collab',
      title: 'What collaborators see',
      body: `- Same files and editor content in real time
- Live cursors and presence avatars
- Shared terminal output when someone compiles or deploys
- Audit results update for everyone when a scan finishes`,
    },
    {
      id: 'roles',
      title: 'Editor vs viewer',
      body: `**Editors** can change code, compile, deploy, and push to GitHub.

**Viewers** can read files and terminal output but cannot edit or run destructive actions.`,
    },
  ],
}
