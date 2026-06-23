export default {
  title: 'Deploying to Testnet step by step',
  description: 'Get a compiled contract live on Stellar Testnet.',
  editFile: 'guide/deploy-testnet.js',
  sections: [
    {
      id: 'prerequisites',
      title: 'Before you deploy',
      body: `- Compile succeeded and a \`.wasm\` file exists
- Network toggle is set to **Testnet**
- Wallet has Testnet XLM (use Friendbot if needed)`,
    },
    {
      id: 'open-deploy',
      title: 'Open the deploy panel',
      body: `Click **Deploy** in the IDE toolbar. Choose:

- **Generate wallet** for a quick Testnet keypair in your browser
- **Connect wallet** if you use Freighter`,
    },
    {
      id: 'fund',
      title: 'Fund the wallet',
      body: `On Testnet, click **Fund via Friendbot** when balance is 0.

Wait a few seconds, then confirm balance updated before deploying.`,
    },
    {
      id: 'deploy',
      title: 'Deploy',
      body: `Click the deploy button. Approve the transaction in Freighter if using a connected wallet.

The terminal shows progress. On success you get a **Contract ID**. Save it; you need it to invoke the contract.`,
    },
    {
      id: 'verify',
      title: 'Verify deployment',
      body: `Use the Stellar Expert link from the deploy panel to confirm the contract exists on Testnet.

Mainnet deploy works the same way but uses real XLM and no Friendbot.`,
    },
  ],
}
