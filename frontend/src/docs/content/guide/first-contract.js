export default {
  title: 'Your first contract in 5 minutes',
  description: 'Create, compile, fund, and deploy a Hello World contract on Testnet.',
  editFile: 'guide/first-contract.js',
  sections: [
    {
      id: 'step-1',
      title: '1. Click New Project',
      body: `On the dashboard, click **New Project**. Enter a name like \`hello-world-demo\`.`,
    },
    {
      id: 'step-2',
      title: '2. Pick the Hello World template',
      body: `Select **Hello World** from the template grid. It includes \`src/lib.rs\` and \`Cargo.toml\` ready to compile.`,
    },
    {
      id: 'step-3',
      title: '3. Read the code',
      body: `\`#![no_std]\` tells Rust this is an on-chain contract.

\`#[contract]\` marks your contract struct.

\`get_greeting\` reads stored text from contract storage.

\`set_greeting\` updates the greeting. \`caller.require_auth()\` ensures only the signed-in account can change it.`,
    },
    {
      id: 'step-4',
      title: '4. Click Compile',
      body: `Click **Compile** in the IDE toolbar. The terminal shows \`cargo build\` output.

When you see a success message and a \`.wasm\` file in the file tree, compilation worked.`,
    },
    {
      id: 'step-5',
      title: '5. Fund with Friendbot (Testnet)',
      body: `Open the **Deploy** panel. Generate a wallet or connect Freighter on Testnet.

If balance is 0, click **Fund via Friendbot** to receive free Testnet XLM.`,
    },
    {
      id: 'step-6',
      title: '6. Click Deploy',
      body: `Click deploy and approve the transaction in your wallet if prompted.

The terminal prints a **Contract ID** (starts with \`C...\`). This is your contract's address on Stellar.`,
    },
    {
      id: 'step-7',
      title: '7. View on Stellar Expert',
      body: `After deploy, click the Stellar Expert link in the deploy panel.

You can inspect the contract hash, transactions, and network details there.`,
    },
  ],
}
