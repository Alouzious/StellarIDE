import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Circle, Loader2, Rocket } from 'lucide-react'
import Modal from './ui/Modal'
import Input from './ui/Input'
import { MAINNET_CONFIRM_TEXT } from '../lib/mainnetDeploy'

function ChecklistRow({ item }) {
  const Icon = item.ok ? CheckCircle : Circle
  const color = item.ok
    ? 'text-green-400'
    : item.required
      ? 'text-red-400'
      : 'text-amber-400'
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${color}`} />
      <span className={item.ok ? 'text-stellar-text' : 'text-stellar-muted'}>
        {item.label}
        {!item.required && !item.ok && (
          <span className="text-stellar-border"> (recommended)</span>
        )}
      </span>
    </li>
  )
}

export default function MainnetDeployModal({
  open,
  onClose,
  onConfirm,
  checklist,
  walletAddress,
  balance,
  wasmFileName,
  deploying = false,
}) {
  const [acknowledged, setAcknowledged] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  useEffect(() => {
    if (!open) {
      setAcknowledged(false)
      setConfirmText('')
    }
  }, [open])

  const canConfirm = acknowledged && confirmText.trim().toUpperCase() === MAINNET_CONFIRM_TEXT

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirm Mainnet deploy"
      className="max-w-lg"
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deploying}
            className="px-4 py-2 text-sm text-stellar-muted hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm || deploying}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deploying
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Deploying…</>
              : <><Rocket className="w-4 h-4" /> Deploy to Mainnet</>}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm text-amber-100 leading-relaxed">
            <p className="font-semibold text-amber-200">You are deploying to Mainnet</p>
            <p>
              This transaction uses real XLM and cannot be undone. Only proceed if you have
              tested on Testnet and reviewed your contract.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-stellar-heading uppercase tracking-wider">
            Pre-deploy checklist
          </p>
          <ul className="space-y-2">
            {checklist.map((item) => (
              <ChecklistRow key={item.id} item={item} />
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-stellar-border bg-stellar-surface p-3 space-y-1">
            <span className="text-stellar-border uppercase tracking-wider">Wallet</span>
            <p className="font-mono text-stellar-text truncate" title={walletAddress}>
              {walletAddress ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}` : '—'}
            </p>
          </div>
          <div className="rounded-lg border border-stellar-border bg-stellar-surface p-3 space-y-1">
            <span className="text-stellar-border uppercase tracking-wider">Balance</span>
            <p className="font-mono text-stellar-text">{parseFloat(balance || '0').toFixed(2)} XLM</p>
          </div>
          {wasmFileName && (
            <div className="col-span-2 rounded-lg border border-stellar-border bg-stellar-surface p-3 space-y-1">
              <span className="text-stellar-border uppercase tracking-wider">WASM</span>
              <p className="font-mono text-stellar-text truncate" title={wasmFileName}>{wasmFileName}</p>
            </div>
          )}
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-1 rounded border-stellar-border bg-stellar-surface text-amber-500 focus:ring-amber-500/50"
          />
          <span className="text-sm text-stellar-muted leading-relaxed">
            I understand this deploys to the live Stellar network, uses real XLM, and I have
            tested this contract on Testnet.
          </span>
        </label>

        <Input
          label={`Type ${MAINNET_CONFIRM_TEXT} to confirm`}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={MAINNET_CONFIRM_TEXT}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </Modal>
  )
}
