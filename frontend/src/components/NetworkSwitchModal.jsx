import { AlertTriangle } from 'lucide-react'
import Modal from './ui/Modal'

export default function NetworkSwitchModal({ open, onClose, onConfirm }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Switch to Mainnet?"
      className="max-w-md"
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-stellar-muted hover:text-white transition-colors"
          >
            Stay on Testnet
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-black transition-colors"
          >
            Switch to Mainnet
          </button>
        </div>
      }
    >
      <div className="flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-2 text-sm text-stellar-muted leading-relaxed">
          <p>
            Mainnet is the live Stellar network. Deployments and transactions use real XLM.
          </p>
          <p>
            Use Testnet for development. Switch to Mainnet only when you are ready to deploy
            a tested contract with a connected wallet.
          </p>
        </div>
      </div>
    </Modal>
  )
}
