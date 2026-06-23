import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { BookOpen, X, Copy, Loader2, RefreshCw } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

function MarkdownCode({ inline, className, children }) {
  const language = (className || '').replace('language-', '')
  if (inline) {
    return (
      <code className="px-1 py-0.5 rounded bg-stellar-bg border border-stellar-border text-stellar-accent font-mono text-[11px]">
        {children}
      </code>
    )
  }
  const code = String(children).replace(/\n$/, '')
  return (
    <div className="my-2 rounded-lg overflow-hidden border border-stellar-border">
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language || 'rust'}
        PreTag="div"
        customStyle={{ margin: 0, padding: '12px', fontSize: '11px', background: 'transparent' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

export default function AiExplainPanel({
  filePath,
  content,
  status,
  error,
  onClose,
  onRetry,
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!content) return
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="h-full flex flex-col bg-stellar-bg">
      <div className="flex items-center justify-between px-4 py-2 border-b border-stellar-border bg-stellar-card flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-stellar-heading uppercase tracking-wide truncate">
            Contract Explanation
          </span>
          {filePath && (
            <span className="text-[10px] text-stellar-muted truncate hidden sm:inline">
              {filePath}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {content && (
            <button
              type="button"
              onClick={handleCopy}
              className="text-xs px-2 py-0.5 rounded border border-stellar-border text-stellar-muted hover:text-white transition-colors inline-flex items-center gap-1"
            >
              <Copy className="w-3 h-3" />
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
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

      <div className="flex-1 overflow-auto p-4">
        {status === 'running' && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-stellar-muted">
            <Loader2 className="w-8 h-8 animate-spin text-stellar-accent" />
            <p className="text-sm">Analyzing your contract...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error || 'AI explanation failed. Check that GROQ_API_KEY is configured.'}
          </div>
        )}

        {status === 'done' && content && (
          <div className="prose prose-invert prose-sm max-w-none text-stellar-text [&_h2]:text-stellar-heading [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_p]:text-stellar-muted [&_li]:text-stellar-muted [&_ul]:my-2">
            <ReactMarkdown components={{ code: MarkdownCode }}>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
