import { useMemo, useState } from 'react'
import { Sparkles, X, Loader2, RefreshCw, Check, XCircle } from 'lucide-react'
import { simpleDiffLines } from '../lib/aiContext'

function DiffView({ before, after }) {
  const lines = useMemo(() => simpleDiffLines(before, after), [before, after])
  return (
    <div className="rounded-lg border border-stellar-border overflow-hidden font-mono text-[11px] leading-5">
      {lines.map((line, i) => (
        <div
          key={i}
          className={
            line.type === 'added'
              ? 'bg-green-500/10 text-green-300 px-3'
              : line.type === 'removed'
              ? 'bg-red-500/10 text-red-300 px-3 line-through opacity-80'
              : 'text-stellar-muted px-3 bg-stellar-bg/50'
          }
        >
          {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}
          {line.text || ' '}
        </div>
      ))}
    </div>
  )
}

export default function AiFixPanel({
  filePath,
  proposal,
  status,
  error,
  readOnly,
  onClose,
  onRetry,
  onApply,
  onReject,
  onToggleFix,
}) {
  const [expanded, setExpanded] = useState(() => new Set([0]))

  const confidenceLabel = proposal?.confidence === 'high'
    ? 'High confidence fix'
    : 'Suggested fix: review carefully'

  const confidenceClass = proposal?.confidence === 'high'
    ? 'text-green-400 border-green-500/40 bg-green-500/10'
    : 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10'

  const toggleExpand = (idx) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <div className="h-full flex flex-col bg-stellar-bg">
      <div className="flex items-center justify-between px-4 py-2 border-b border-stellar-border bg-stellar-card flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-stellar-accent flex-shrink-0" />
          <span className="text-xs font-semibold text-stellar-heading uppercase tracking-wide truncate">
            AI Fix Proposal
          </span>
          {filePath && (
            <span className="text-[10px] text-stellar-muted truncate hidden sm:inline">
              {filePath}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {status === 'error' && (
            <button
              type="button"
              onClick={onRetry}
              className="text-xs px-2 py-0.5 rounded border border-stellar-border text-stellar-accent hover:bg-stellar-accent/10 transition-colors inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          )}
          <button type="button" onClick={onClose} className="text-stellar-border hover:text-stellar-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {status === 'running' && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-stellar-muted min-h-[120px]">
            <Loader2 className="w-8 h-8 animate-spin text-stellar-accent" />
            <p className="text-sm">Analyzing your contract...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 space-y-2">
            <p>{error || 'AI fix failed. Check that GROQ_API_KEY is configured.'}</p>
            <a href="/docs/ai-assistant" target="_blank" rel="noopener noreferrer" className="inline-flex text-stellar-accent hover:underline text-xs">
              Read the docs
            </a>
          </div>
        )}

        {status === 'done' && proposal && (
          <>
            <div className="space-y-2">
              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${confidenceClass}`}>
                {confidenceLabel}
              </span>
              {proposal.summary && (
                <p className="text-sm text-stellar-muted">{proposal.summary}</p>
              )}
            </div>

            {proposal.fixes?.map((fix, idx) => (
              <div key={`${fix.file_path}-${idx}`} className="rounded-lg border border-stellar-border bg-stellar-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpand(idx)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-stellar-surface/60 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={fix.selected !== false}
                    onChange={(e) => {
                      e.stopPropagation()
                      onToggleFix?.(idx, e.target.checked)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-stellar-border"
                    disabled={readOnly}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-stellar-heading truncate">{fix.file_path}</p>
                    <p className="text-xs text-stellar-muted truncate">{fix.reason}</p>
                  </div>
                </button>
                {expanded.has(idx) && (
                  <div className="px-3 pb-3 space-y-2 border-t border-stellar-border/50">
                    <p className="text-[10px] uppercase tracking-wider text-stellar-border pt-2">Diff</p>
                    <DiffView before={fix.original} after={fix.fixed} />
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {status === 'done' && proposal && !readOnly && (
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-stellar-border bg-stellar-card flex-shrink-0">
          <button
            type="button"
            onClick={onReject}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-stellar-border text-stellar-muted hover:text-white text-xs transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" />
            Reject Fix
          </button>
          <button
            type="button"
            onClick={onApply}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-stellar-accent hover:bg-stellar-accent-hover text-white text-xs font-semibold transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Apply Fix
          </button>
        </div>
      )}
    </div>
  )
}
