import { useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: AlertCircle,
}

const colors = {
  success: 'border-green-500/30 bg-green-500/10 text-green-400',
  error: 'border-red-500/30 bg-red-500/10 text-red-400',
  warning: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
  info: 'border-stellar-accent/30 bg-stellar-accent/10 text-stellar-accent',
}

export function Toast({ id, type = 'info', message, onRemove }) {
  const Icon = icons[type]
  useEffect(() => {
    const timer = setTimeout(() => onRemove(id), 4000)
    return () => clearTimeout(timer)
  }, [id, onRemove])

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg animate-slide-up ${colors[type]}`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="text-sm font-medium text-stellar-text">{message}</span>
      <button onClick={() => onRemove(id)} className="ml-auto text-stellar-muted hover:text-white transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <Toast key={t.id} {...t} onRemove={onRemove} />
      ))}
    </div>
  )
}
