export default {
  title: 'Wallet Integration',
  description: 'Generated wallets and Freighter connection for signing Soroban deployments.',
  editFile: 'wallet.js',
  sections: [
    {
      id: 'network-toggle',
      title: 'Network toggle',
      body: `The IDE header includes a Testnet / Mainnet toggle. This sets which network deploy and balance checks use.

Your connected wallet must match the selected network passphrase.`,
    },
    {
      id: 'generated-wallet',
      title: 'Generated wallet',
      body: `From the deploy panel, click **Generate Wallet** to create a keypair in the browser.

The secret key stays in your session. StellarIDE stores only the public key in project state for display. Fund Testnet wallets via Friendbot before deploying.`,
    },
    {
      id: 'connected-wallet',
      title: 'Connected wallet (Freighter)',
      body: `Click **Connect Wallet** to open the Stellar Wallets Kit modal. Supported wallets include Freighter, xBull, Albedo, and others from the kit.

The deploy flow requests a wallet signature in your browser. The backend never receives your secret key for connected wallets.`,
    },
    {
      id: 'balance',
      title: 'Balance checks',
      body: `Wallet balance is fetched from Horizon:

- Testnet: \`https://horizon-testnet.stellar.org\`
- Mainnet: \`https://horizon.stellar.org\`

Low balance warnings appear in the deploy panel before you deploy.`,
    },
  ],
}
