import { Terminal as TerminalIcon, X, Plus, Maximize2, Minimize2,
  ExternalLink, Share2, AlertCircle, Loader2,
} from 'lucide-react'
import OutputPanel from './OutputPanel'
import Terminal from './Terminal'
import SharedTerminalView from './SharedTerminalView'

export default function BottomPanel({
  activeTab,
  onTabChange,
  outputProps,
  problems,
  readOnly,
  projectId,
  projectName,
  token,
  terminalInstances,
  activeTerminalId,
  onSelectTerminal,
  onNewTerminal,
  onCloseTerminal,
  onShareTerminal,
  onTerminalStatus,
  terminalPopOut,
  onTogglePopOut,
  panelMaximized,
  onToggleMaximize,
  sharedTerminal,
  onDismissShared,
}) {
  const activeInstance = terminalInstances.find((t) => t.id === activeTerminalId)

  const problemCount = problems.length

  return (
    <div className={`h-full flex flex-col bg-stellar-bg ${terminalPopOut ? 'fixed inset-4 z-40 rounded-xl border border-stellar-border shadow-2xl' : ''}`}>
      <div className="flex items-center border-b border-stellar-border bg-stellar-card flex-shrink-0 min-h-[36px]">
        <div className="flex items-center flex-1 min-w-0 overflow-x-auto">
          {[
            { id: 'output', label: 'Output' },
            { id: 'terminal', label: 'Terminal' },
            { id: 'problems', label: 'Problems', badge: problemCount || null },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-stellar-accent text-stellar-accent'
                  : 'border-transparent text-stellar-muted hover:text-white'
              }`}
            >
              {tab.label}
              {tab.badge ? (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px]">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}

          {activeTab === 'terminal' && (
            <div className="flex items-center border-l border-stellar-border ml-1 pl-1">
              {terminalInstances.map((inst) => (
                <div key={inst.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => onSelectTerminal(inst.id)}
                    className={`px-2 py-1.5 text-[11px] rounded-t transition-colors max-w-[120px] truncate ${
                      inst.id === activeTerminalId
                        ? 'bg-stellar-surface text-stellar-text'
                        : 'text-stellar-muted hover:text-white'
                    }`}
                  >
                    {inst.title}
                    {inst.status === 'connecting' && <Loader2 className="inline w-3 h-3 ml-1 animate-spin" />}
                  </button>
                  {terminalInstances.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onCloseTerminal(inst.id)}
                      className="p-1 text-stellar-border hover:text-red-400"
                      title="Close terminal"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {!readOnly && (
                <button
                  type="button"
                  onClick={onNewTerminal}
                  className="p-1.5 text-stellar-muted hover:text-stellar-accent"
                  title="New terminal"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 px-2 flex-shrink-0">
          {activeTab === 'terminal' && activeInstance && !readOnly && (
            <button
              type="button"
              onClick={() => onShareTerminal(activeInstance.id, !activeInstance.shareEnabled)}
              className={`p-1.5 rounded transition-colors ${
                activeInstance.shareEnabled
                  ? 'text-stellar-accent bg-stellar-accent/10'
                  : 'text-stellar-muted hover:text-white'
              }`}
              title={activeInstance.shareEnabled ? 'Stop sharing terminal' : 'Share terminal with collaborators'}
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onTogglePopOut}
            className="p-1.5 text-stellar-muted hover:text-white md:hidden"
            title="Pop out terminal"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggleMaximize}
            className="p-1.5 text-stellar-muted hover:text-white hidden sm:block"
            title={panelMaximized ? 'Restore panel size' : 'Maximize panel'}
          >
            {panelMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'output' && <OutputPanel {...outputProps} />}
        {activeTab === 'terminal' && sharedTerminal?.active && (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-stellar-border bg-amber-500/10 text-xs text-amber-200">
              <span>Live shared terminal from {sharedTerminal.userName} (read-only)</span>
              {onDismissShared && (
                <button type="button" onClick={onDismissShared} className="text-amber-100 hover:underline">
                  Back to my terminal
                </button>
              )}
            </div>
            <div className="flex-1 min-h-0">
              <SharedTerminalView userName={sharedTerminal.userName} chunks={sharedTerminal.chunks} />
            </div>
          </div>
        )}
        {activeTab === 'terminal' && !sharedTerminal?.active && activeInstance && token && (
          <Terminal
            key={activeInstance.id}
            projectId={projectId}
            token={token}
            sessionId={activeInstance.sessionId}
            projectName={projectName}
            readOnly={readOnly}
            shareEnabled={activeInstance.shareEnabled}
            reconnectKey={activeInstance.reconnectKey || 0}
            onStatusChange={(status) => onTerminalStatus?.(activeInstance.id, status)}
          />
        )}
        {activeTab === 'terminal' && !activeInstance && (
          <div className="h-full flex items-center justify-center text-stellar-muted text-sm">
            <TerminalIcon className="w-4 h-4 mr-2" />
            Open a terminal tab to start a shell session
          </div>
        )}
        {activeTab === 'problems' && (
          <div className="h-full overflow-auto p-3 space-y-2">
            {problems.length === 0 ? (
              <p className="text-xs text-stellar-border">No problems detected.</p>
            ) : (
              problems.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={p.onClick}
                  className="w-full text-left flex items-start gap-2 px-3 py-2 rounded-lg border border-stellar-border bg-stellar-surface hover:border-stellar-accent/40 transition-colors"
                >
                  <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${p.severity === 'error' ? 'text-red-400' : 'text-amber-400'}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-stellar-text truncate">{p.title}</p>
                    {p.detail && <p className="text-[11px] text-stellar-muted mt-0.5 line-clamp-2">{p.detail}</p>}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
