export default {
  title: 'Frequently asked questions',
  description: 'Common questions about using StellarIDE.',
  editFile: 'guide/faq.js',
  sections: [
    {
      id: 'free',
      title: 'Is StellarIDE free?',
      body: `Yes. StellarIDE is free to use. You pay only Stellar network fees when deploying to Mainnet.`,
    },
    {
      id: 'install',
      title: 'Do I need to install anything?',
      body: `No Rust or Cargo install is required in the browser. For deploy with Freighter, install the [Freighter extension](https://www.freighter.app/).`,
    },
    {
      id: 'contract-id',
      title: 'What is a Contract ID?',
      body: `A Contract ID (starts with \`C\`) is the unique address of your deployed Soroban contract on Stellar. You use it to invoke contract functions.`,
    },
    {
      id: 'networks',
      title: 'What is Testnet vs Mainnet?',
      body: `**Testnet** is for development. XLM is free via Friendbot. **Mainnet** is the live Stellar network. Real XLM pays fees. Never deploy untested code to Mainnet.`,
    },
    {
      id: 'own-wallet',
      title: 'Can I use my own wallet?',
      body: `Yes. Connect Freighter or use a generated in-browser wallet for Testnet experiments.`,
    },
    {
      id: 'save',
      title: 'How do I save my work?',
      body: `Files save to your StellarIDE account automatically while you type (debounced) or when you click **Save**. Link GitHub to push copies to a repository.`,
    },
    {
      id: 'close-tab',
      title: 'What happens if I close the tab?',
      body: `Saved files remain in your project. Unsaved editor changes may be lost if auto-save had not run yet. Click **Save** before closing if unsure.`,
    },
    {
      id: 'export',
      title: 'Can I export my code?',
      body: `Yes. Copy files from the editor, push to GitHub, or clone via the linked repository.`,
    },
    {
      id: 'collab',
      title: 'How does collaboration work?',
      body: `Share an invite link. Multiple editors see the same files with live cursors. Terminal and audit output sync to all connected users.`,
    },
    {
      id: 'secret-key',
      title: 'Is my secret key safe?',
      body: `Generated wallet keys stay in your browser session. Freighter never shares your secret with StellarIDE. We do not store deploy secret keys on the server for connected wallets.`,
    },
  ],
}
