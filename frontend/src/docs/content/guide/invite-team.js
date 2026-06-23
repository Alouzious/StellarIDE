export default {
  title: 'Inviting teammates',
  description: 'Share a project and collaborate in real time.',
  editFile: 'guide/invite-team.js',
  sections: [
    {
      id: 'share',
      title: 'Open Share',
      body: `In the IDE, click **Share** in the top bar. Choose **Editor** (can edit) or **Viewer** (read-only).`,
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
