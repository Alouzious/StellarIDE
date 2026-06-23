export default {
  title: 'Deploying to Mainnet',
  description: 'Safely deploy a tested Soroban contract to the live Stellar network.',
  editFile: 'guide/deploy-mainnet.js',
  sections: [
    {
      id: 'before-mainnet',
      title: 'Before you deploy to Mainnet',
      body: `Mainnet is the live Stellar network. Deployments spend real XLM and cannot be undone.

Complete this checklist first:

- Compile and test on **Testnet**
- Run **Scout audit** and review findings
- Deploy to Testnet and verify the contract behaves as expected
- Fund a Mainnet wallet with enough XLM for fees`,
    },
    {
      id: 'switch-network',
      title: 'Switch to Mainnet',
      body: `Use the **Mainnet** toggle in the IDE header. StellarIDE asks you to confirm before switching.

Mainnet deploys require a **connected wallet** (Freighter, xBull, Ledger, etc.). Browser-generated wallets and Friendbot are Testnet only.`,
    },
    {
      id: 'wizard',
      title: 'Mainnet deploy wizard',
      body: `Open the **Deploy** panel. On Mainnet the steps are:

1. **Connect** your wallet and confirm it is on Mainnet
2. **Review** the pre-deploy checklist (WASM, balance, optional tests/audit)
3. **Deploy** after confirming in the safety modal

The deploy button stays disabled until required checklist items pass. You must type **DEPLOY** and acknowledge the warning before signing.`,
    },
    {
      id: 'fees',
      title: 'Fees and balance',
      body: `Keep at least **2 XLM** in your connected wallet for Soroban deploy fees. Actual cost depends on contract size and network conditions.

Refresh balance from the deploy panel before deploying.`,
    },
    {
      id: 'after-deploy',
      title: 'After deploy',
      body: `Save the Contract ID. Use **Verify on Stellar Expert** in the deploy panel to confirm your WASM matches on-chain bytecode.

For full source validation on Stellar Expert, link GitHub and use the [soroban-build-workflow](https://github.com/stellar-expert/soroban-build-workflow).`,
    },
  ],
}
