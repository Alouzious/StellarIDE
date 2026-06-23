import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, footer, className = '', bodyClassName = '' }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={`relative bg-stellar-card border border-stellar-border rounded-2xl shadow-2xl w-full max-w-md animate-fade-in flex flex-col max-h-[90vh] ${className}`}>
        {title && (
          <div className="flex items-center justify-between p-6 border-b border-stellar-border flex-shrink-0">
            <h2 className="text-lg font-semibold text-stellar-heading">{title}</h2>
            <button
              onClick={onClose}
              className="text-stellar-muted hover:text-white transition-colors p-1 rounded-md hover:bg-stellar-surface"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className={`p-6 overflow-y-auto flex-1 min-h-0 ${bodyClassName}`}>{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-stellar-border bg-stellar-surface/90 rounded-b-2xl flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
