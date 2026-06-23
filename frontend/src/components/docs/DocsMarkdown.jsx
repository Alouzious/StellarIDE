import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

function CodeBlock({ inline, className, children }) {
  const language = (className || '').replace('language-', '')
  if (inline) {
    return (
      <code className="px-1 py-0.5 rounded bg-stellar-bg border border-stellar-border text-stellar-accent font-mono text-[0.85em]">
        {children}
      </code>
    )
  }
  const code = String(children).replace(/\n$/, '')
  return (
    <div className="my-4 rounded-lg overflow-hidden border border-stellar-border">
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language || 'text'}
        PreTag="div"
        customStyle={{ margin: 0, padding: '14px', fontSize: '12px', background: '#0a0e1a' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

export default function DocsMarkdown({ children }) {
  return (
    <ReactMarkdown
      components={{
        code: CodeBlock,
        h3: ({ children }) => <h3 className="text-base font-semibold text-stellar-heading mt-6 mb-2">{children}</h3>,
        p: ({ children }) => <p className="text-stellar-muted leading-relaxed mb-3">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-5 space-y-1.5 mb-4 text-stellar-muted">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1.5 mb-4 text-stellar-muted">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        a: ({ href, children }) => (
          <a href={href} className="text-stellar-accent hover:underline" target={href?.startsWith('http') ? '_blank' : undefined} rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}>
            {children}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
