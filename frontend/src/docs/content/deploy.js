export default {
  title: 'Deploy Contracts',
  description: 'Deploy compiled WASM contracts to Stellar Testnet or Mainnet from StellarIDE.',
  editFile: 'deploy.js',
  sections: [
    {
      id: 'prerequisites',
      title: 'Prerequisites',
      body: `- A successful compile that produced a \`.wasm\` file
- A funded wallet on the target network
- Network toggle set to Testnet or Mainnet in the IDE`,
    },
    {
      id: 'deploy-panel',
      title: 'Deploy panel',
      body: `Click **Deploy** in the toolbar to open the deploy panel.

Choose:

- **Generated wallet**: keypair created in your browser (secret never sent to the server)
- **Connected wallet**: Freighter or other wallets via Stellar Wallets Kit

Deployment uses the Stellar CLI (\`stellar contract deploy\`) under the hood.`,
    },
    {
      id: 'streaming',
      title: 'Streaming deploy',
      body: `Deploy output streams via SSE:

\`\`\`http
POST /api/v1/projects/:id/deploy/stream
Content-Type: application/json

{
  "network": "testnet",
  "wallet_address": "G...",
  "secret_key": "S..."   // generated wallet only; connected wallets sign in browser
}
\`\`\`

On success the terminal shows the contract ID and links to Stellar Expert and Stellar Lab.`,
    },
    {
      id: 'testnet-funding',
      title: 'Testnet funding',
      body: `For Testnet, fund a generated or connected wallet with Friendbot from the deploy panel.

Mainnet deployments require a connected wallet with sufficient XLM for fees. StellarIDE does not hold your keys on the server.`,
    },
    {
      id: 'mainnet-wizard',
      title: 'Mainnet deploy wizard',
      body: `When the network toggle is set to Mainnet, the deploy panel uses a dedicated wizard:

- **Connect → Review → Deploy** step flow
- Requires an external wallet (no Friendbot or browser-generated keypair)
- Pre-deploy checklist: WASM compiled, wallet connected, network match, minimum balance
- Recommended: tests and Scout audit completed in the session
- Confirmation modal: acknowledge risks and type \`DEPLOY\` before signing`,
    },
    {
      id: 'collab-lock',
      title: 'Deploy lock',
      body: `When one user deploys, collaborators see a deploy lock indicator so two deploys do not race. The lock clears when deploy finishes.`,
    },
  ],
}
