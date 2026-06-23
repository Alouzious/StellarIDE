import { StellarWalletsKit } from '@creit-tech/stellar-wallets-kit/sdk'
import { SwkAppDarkTheme, Networks } from '@creit-tech/stellar-wallets-kit/types'
import { defaultModules } from '@creit-tech/stellar-wallets-kit/modules/utils'
import { LedgerModule } from '@creit-tech/stellar-wallets-kit/modules/ledger'

let initialized = false

export function networkToPassphrase(network) {
  return network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET
}

export function passphraseToNetwork(passphrase) {
  if (passphrase === Networks.PUBLIC) return 'mainnet'
  return 'testnet'
}

export function initWalletKit(network = 'testnet') {
  if (typeof window === 'undefined') return

  StellarWalletsKit.init({
    theme: SwkAppDarkTheme,
    network: networkToPassphrase(network),
    modules: [
      ...defaultModules(),
      new LedgerModule(),
    ],
    authModal: {
      hideUnsupportedWallets: true,
    },
  })
  initialized = true
}

export function reinitWalletKit(network) {
  initWalletKit(network)
}

export function getWalletKit() {
  if (!initialized) {
    initWalletKit('testnet')
  }
  return StellarWalletsKit
}

export { StellarWalletsKit, Networks }
