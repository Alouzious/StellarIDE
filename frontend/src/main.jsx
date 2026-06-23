import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initWalletKit } from './lib/walletKit'
import useWalletStore from './features/wallet/walletStore'

initWalletKit('testnet')
useWalletStore.getState().attachKitListeners()
useWalletStore.getState().restoreSession()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
