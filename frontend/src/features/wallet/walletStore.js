import { create } from 'zustand'
import { KitEventType } from '@creit-tech/stellar-wallets-kit/types'
import { getWalletKit, reinitWalletKit, networkToPassphrase, passphraseToNetwork } from '../../lib/walletKit'

const HORIZON = {
  testnet: 'https://horizon-testnet.stellar.org',
  mainnet: 'https://horizon.stellar.org',
}

export const WALLET_LABELS = {
  freighter: 'Freighter',
  albedo: 'Albedo',
  xbull: 'xBull',
  rabet: 'Rabet',
  hana: 'Hana',
  lobstr: 'Lobstr',
  hotwallet: 'Hot Wallet',
  klever: 'Klever',
  onekey: 'OneKey',
  bitget: 'Bitget',
  ledger: 'Ledger',
}

let listenersAttached = false

const useWalletStore = create((set, get) => ({
  connectedAddress: null,
  connectedWalletId: null,
  walletNetworkPassphrase: null,
  network: 'testnet',
  walletBalance: null,
  isConnecting: false,
  lastDeployContractId: null,

  walletLabel: () => {
    const id = get().connectedWalletId
    if (!id) return 'Wallet'
    return WALLET_LABELS[id] || id
  },

  setNetwork: (network) => {
    set({ network, walletBalance: null })
    reinitWalletKit(network)
    const { connectedAddress } = get()
    if (connectedAddress) {
      get().fetchBalance(connectedAddress, network)
    }
  },

  fetchBalance: async (address, network) => {
    if (!address) return null
    const net = network || get().network
    const base = HORIZON[net] || HORIZON.testnet
    try {
      const r = await fetch(`${base}/accounts/${address}`)
      if (!r.ok) {
        set({ walletBalance: '0' })
        return '0'
      }
      const data = await r.json()
      const balance = data.balances?.find((b) => b.asset_type === 'native')?.balance ?? '0'
      set({ walletBalance: balance })
      return balance
    } catch {
      set({ walletBalance: '0' })
      return '0'
    }
  },

  connectWallet: async () => {
    const kit = getWalletKit()
    set({ isConnecting: true })
    try {
      const { address } = await kit.authModal()
      set({
        connectedAddress: address,
        isConnecting: false,
        connectedWalletId: get().connectedWalletId,
      })
      await get().fetchBalance(address, get().network)
      return { success: true, address }
    } catch (err) {
      set({ isConnecting: false })
      if (err?.code === -1) {
        return { success: false, cancelled: true }
      }
      return { success: false, error: err?.message || 'Failed to connect wallet' }
    }
  },

  disconnectWallet: async () => {
    try {
      await getWalletKit().disconnect()
    } catch {
      // ignore
    }
    set({
      connectedAddress: null,
      connectedWalletId: null,
      walletBalance: null,
      walletNetworkPassphrase: null,
    })
  },

  restoreSession: async () => {
    const kit = getWalletKit()
    try {
      const { address } = await kit.getAddress()
      set({ connectedAddress: address })
      await get().fetchBalance(address, get().network)
      return true
    } catch {
      return false
    }
  },

  attachKitListeners: () => {
    if (listenersAttached) return
    listenersAttached = true
    const kit = getWalletKit()

    kit.on(KitEventType.STATE_UPDATED, (event) => {
      const { address, networkPassphrase } = event.payload
      set({
        connectedAddress: address || null,
        walletNetworkPassphrase: networkPassphrase || null,
      })
      if (address) {
        const net = passphraseToNetwork(networkPassphrase)
        get().fetchBalance(address, net)
      }
    })

    kit.on(KitEventType.WALLET_SELECTED, (event) => {
      set({ connectedWalletId: event.payload.id || null })
    })

    kit.on(KitEventType.DISCONNECT, () => {
      set({
        connectedAddress: null,
        connectedWalletId: null,
        walletBalance: null,
        walletNetworkPassphrase: null,
      })
    })
  },

  networkMatchesWallet: () => {
    const { network, walletNetworkPassphrase } = get()
    if (!walletNetworkPassphrase) return true
    return networkToPassphrase(network) === walletNetworkPassphrase
  },

  setLastDeployContractId: (contractId) => set({ lastDeployContractId: contractId }),
}))

export default useWalletStore
