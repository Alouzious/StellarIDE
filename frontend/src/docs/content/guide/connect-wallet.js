export default {
  title: 'Connecting Freighter wallet',
  description: 'Install Freighter, switch to Testnet, and connect in StellarIDE.',
  editFile: 'guide/connect-wallet.js',
  sections: [
    {
      id: 'what-is-freighter',
      title: 'What is Freighter?',
      body: `Freighter is a browser wallet for Stellar. StellarIDE uses it to sign deploy transactions without sending your secret key to our servers.`,
    },
    {
      id: 'install',
      title: 'Install Freighter',
      body: `1. Go to [freighter.app](https://www.freighter.app/) and install the browser extension
2. Create or import a Stellar account
3. Keep your recovery phrase offline and private`,
    },
    {
      id: 'testnet',
      title: 'Switch Freighter to Testnet',
      body: `Open Freighter settings and set the network to **Testnet**.

In StellarIDE, set the network toggle to **Testnet** as well. Both must match.`,
    },
    {
      id: 'connect',
      title: 'Connect in StellarIDE',
      body: `Open the Deploy panel and click **Connect Wallet**. Choose Freighter and approve the connection.

Your public address appears in the panel. StellarIDE never receives your secret key from Freighter.`,
    },
    {
      id: 'mismatch',
      title: 'Network mismatch',
      body: `If you see a network mismatch warning, either:

- Switch Freighter to match the IDE toggle, or
- Change the IDE toggle to match Freighter

Deploy is blocked until networks align.`,
    },
  ],
}
