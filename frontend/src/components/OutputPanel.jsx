import { useEffect, useRef, useState } from 'react'
import {
  Terminal, Loader2, Sparkles, HelpCircle, Shield,
} from 'lucide-react'

export default function OutputPanel({
  logs, onClear, onFix, onExplain, hasFixContext, aiBusy, readOnly,
  compileStatus, testStatus, deployStatus, auditStatus,
  showAuditResultsLink, onShowAuditResults,
}) {
  const bottomRef = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)

  const isStreaming =
    compileStatus === 'running' ||
    testStatus === 'running' ||
    deployStatus === 'running' ||
    deployStatus === 'signing' ||
    auditStatus === 'running'

  const headerStatus = (() => {
    if (compileStatus === 'running') return 'Compiling…'
    if (testStatus === 'running') return 'Testing…'
    if (deployStatus === 'running' || deployStatus === 'signing') return 'Deploying…'
    if (auditStatus === 'running') return 'Auditing…'
    return 'Ready'
  })()

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  const colors = {
    info: 'text-stellar-text',
    success: 'text-green-400',
    error: 'text-red-400',
    warning: 'text-yellow-400',
    running: 'text-cyan-400',
  }

  return (
    <div className="h-full flex flex-col bg-stellar-bg">
      <div className="flex items-center justify-between px-4 py-2 border-b border-stellar-border bg-stellar-card flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="w-3.5 h-3.5 text-stellar-muted flex-shrink-0" />
          <span className="text-xs font-semibold text-stellar-muted uppercase tracking-wide truncate">
            Output · {headerStatus}
          </span>
          <div className="flex items-center gap-1.5 ml-1">
            {!readOnly && hasFixContext && (
              <button onClick={onFix} disabled={aiBusy}
                className="flex items-center gap-1 px-2 py-0.5 bg-stellar-accent/15 hover:bg-stellar-accent/25 border border-stellar-accent/30 text-stellar-accent rounded text-xs font-medium transition-all disabled:opacity-50">
                {aiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Fix with AI
              </button>
            )}
            <button onClick={onExplain} disabled={aiBusy}
              title="Explain in AI Chat"
              className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-400 rounded text-xs font-medium transition-all disabled:opacity-50">
              <HelpCircle className="w-3 h-3" />
              Explain
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {showAuditResultsLink && (
            <button
              type="button"
              onClick={onShowAuditResults}
              className="text-xs px-2 py-0.5 rounded border border-stellar-border text-stellar-accent hover:bg-stellar-accent/10 transition-colors inline-flex items-center gap-1"
            >
              <Shield className="w-3 h-3" />
              Audit Results
            </button>
          )}
          <button
            type="button"
            onClick={() => setAutoScroll((v) => !v)}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
              autoScroll
                ? 'border-stellar-accent/40 text-stellar-accent bg-stellar-accent/10'
                : 'border-stellar-border text-stellar-muted hover:text-white'
            }`}
            title={autoScroll ? 'Auto-scroll on' : 'Auto-scroll off'}
          >
            Auto-scroll
          </button>
          <button
            type="button"
            onClick={onClear}
            className="text-xs px-2 py-0.5 rounded border border-stellar-border text-stellar-muted hover:text-white transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-6 space-y-0.5">
        {logs.length === 0
          ? <span className="text-stellar-border">Run a command to see output...</span>
          : logs.map((l, i) => {
            const isLast = i === logs.length - 1
            const showSpinner = isStreaming && isLast && l.level !== 'success' && l.level !== 'error'
            return (
              <div key={l.id} className={colors[l.level] || colors.info}>
                <span className="text-stellar-border mr-2">[{l.timestamp || '--:--:--'}]</span>
                {showSpinner && <span className="text-cyan-400 mr-1">⟳</span>}
                {l.line}
              </div>
            )
          })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
