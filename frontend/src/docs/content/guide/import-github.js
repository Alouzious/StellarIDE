export default {
  title: 'Importing from GitHub',
  description: 'Bring an existing Soroban repo into StellarIDE.',
  editFile: 'guide/import-github.js',
  sections: [
    {
      id: 'connect-github',
      title: 'Connect GitHub',
      body: `Sign in with GitHub or connect GitHub from the dashboard if you registered with email.

StellarIDE needs permission to read repos you select and push commits when you choose to.`,
    },
    {
      id: 'import',
      title: 'Import a repository',
      body: `On the dashboard click **Import from GitHub**. Pick a repository and branch.

If the repo has multiple contract folders, choose the correct subfolder when prompted.`,
    },
    {
      id: 'edit-push',
      title: 'Edit and push back',
      body: `Open the project in the IDE. After changes, use **Push to GitHub** with a commit message.

Preview the diff before pushing to avoid overwriting remote changes unexpectedly.`,
    },
    {
      id: 'link-existing',
      title: 'Link an existing project',
      body: `Already have a StellarIDE project? Use **Link GitHub** inside the IDE to attach a remote repo without re-importing files.`,
    },
  ],
}
