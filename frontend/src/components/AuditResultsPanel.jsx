import { useMemo, useState } from 'react'
import { Shield, X, Download, Terminal, ChevronDown, ChevronUp } from 'lucide-react'

const SEVERITY_ORDER = ['Critical', 'High', 'Medium', 'Low', 'Informational']

const SEVERITY_STYLE = {
  Critical: { badge: 'bg-red-500/20 text-red-300 border-red-500/40', dot: '🔴' },
  High: { badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40', dot: '🟠' },
  Medium: { badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40', dot: '🟡' },
  Low: { badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40', dot: '🔵' },
  Informational: { badge: 'bg-stellar-surface text-stellar-muted border-stellar-border', dot: '⚪' },
}

const RISK_STYLE = {
  'HIGH RISK': 'text-red-400 border-red-500/40 bg-red-500/10',
  'MEDIUM RISK': 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
  'LOW RISK': 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  CLEAN: 'text-green-400 border-green-500/40 bg-green-500/10',
}

function countBySeverity(findings) {
  const counts = { Critical: 0, High: 0, Medium: 0, Low: 0, Informational: 0 }
  findings.forEach((f) => {
    if (counts[f.severity] !== undefined) counts[f.severity] += 1
  })
  return counts
}

export default function AuditResultsPanel({
  findings,
  riskLevel,
  message,
  onClose,
  onSelectFinding,
  onToggleTerminal,
  showTerminal,
}) {
  const [activeFilters, setActiveFilters] = useState(() => new Set(SEVERITY_ORDER))

  const counts = useMemo(() => countBySeverity(findings), [findings])
  const filtered = useMemo(
    () => findings.filter((f) => activeFilters.has(f.severity)),
    [findings, activeFilters]
  )
  const isClean = findings.length === 0

  const toggleFilter = (severity) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(severity)) next.delete(severity)
      else next.add(severity)
      return next
    })
  }

  const exportReport = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      risk_level: riskLevel,
      message,
      findings,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stellaride-audit-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full flex flex-col bg-stellar-bg border-t border-stellar-border">
      <div className="flex items-center justify-between px-4 py-2 border-b border-stellar-border bg-stellar-card flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="w-4 h-4 text-stellar-accent flex-shrink-0" />
          <span className="text-xs font-semibold text-stellar-heading uppercase tracking-wide truncate">
            Audit Results
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${RISK_STYLE[riskLevel] || RISK_STYLE.CLEAN}`}>
            {riskLevel}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onToggleTerminal}
            className="text-xs px-2 py-0.5 rounded border border-stellar-border text-stellar-muted hover:text-white transition-colors inline-flex items-center gap-1"
          >
            <Terminal className="w-3 h-3" />
            {showTerminal ? 'Hide Terminal' : 'View in Terminal'}
          </button>
          <button
            type="button"
            onClick={exportReport}
            className="text-xs px-2 py-0.5 rounded border border-stellar-border text-stellar-muted hover:text-white transition-colors inline-flex items-center gap-1"
          >
            <Download className="w-3 h-3" />
            Export Report
          </button>
          <button type="button" onClick={onClose} className="text-stellar-border hover:text-stellar-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isClean ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-2 max-w-sm">
            <div className="text-3xl">✓</div>
            <p className="text-lg font-semibold text-green-400">Contract Passed Audit</p>
            <p className="text-sm text-stellar-muted">{message || 'No vulnerabilities found by Scout.'}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="px-4 py-3 border-b border-stellar-border bg-stellar-card/50 flex-shrink-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-stellar-muted">{findings.length} issue(s)</span>
              {SEVERITY_ORDER.map((sev) => counts[sev] > 0 && (
                <span key={sev} className="text-stellar-muted">
                  {SEVERITY_STYLE[sev].dot} {sev}({counts[sev]})
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SEVERITY_ORDER.map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => toggleFilter(sev)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                    activeFilters.has(sev)
                      ? SEVERITY_STYLE[sev].badge
                      : 'border-stellar-border text-stellar-border opacity-50'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-3">
            {filtered.map((finding) => (
              <FindingCard key={finding.id} finding={finding} onSelect={() => onSelectFinding?.(finding)} />
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-stellar-muted text-center py-8">No findings match the selected severity filters.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function FindingCard({ finding, onSelect }) {
  const [open, setOpen] = useState(true)
  const style = SEVERITY_STYLE[finding.severity] || SEVERITY_STYLE.Informational
  const location = `${finding.file}:${finding.line_start}${finding.line_end !== finding.line_start ? `-${finding.line_end}` : ''}`

  return (
    <div className="rounded-lg border border-stellar-border bg-stellar-card overflow-hidden">
      <button
        type="button"
        onClick={() => { setOpen(!open); onSelect?.() }}
        className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-stellar-surface/60 transition-colors"
      >
        <span className="text-sm flex-shrink-0">{style.dot}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${style.badge}`}>
              {finding.severity.toUpperCase()}
            </span>
            <span className="text-sm font-semibold text-stellar-heading truncate">{finding.title}</span>
          </div>
          <div className="text-[11px] text-stellar-muted mt-1">
            Category: {finding.category} · {location}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-stellar-border flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-stellar-border flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-stellar-border/50">
          <p className="text-xs text-stellar-text pt-2">{finding.description}</p>
          {finding.code_snippet && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-stellar-border mb-1">Code</p>
              <pre className="text-[11px] font-mono bg-stellar-bg border border-stellar-border rounded p-2 overflow-x-auto text-stellar-text whitespace-pre-wrap">
                {finding.code_snippet}
              </pre>
            </div>
          )}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-stellar-border mb-1">Fix</p>
            <p className="text-xs text-stellar-muted">{finding.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  )
}
