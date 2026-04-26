import { useState, useRef, useEffect } from 'react'
import { X, Send, Loader2, Bot, User, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import useChatStore from '../../features/ide/chatStore'

function CodeBlock({ language, children }) {
  const [copied, setCopied] = useState(false)
  const code = String(children).replace(/\n$/, '')

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group my-2 rounded-lg overflow-hidden border border-stellar-border">
      <div className="flex items-center justify-between px-3 py-1.5 bg-stellar-card border-b border-stellar-border">
        <span className="text-xs text-stellar-border font-mono">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-stellar-border hover:text-stellar-accent transition-colors opacity-0 group-hover:opacity-100"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: '12px',
          fontSize: '11px',
          lineHeight: '1.6',
          background: 'transparent',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${
        isUser
          ? 'bg-stellar-accent/20 border border-stellar-accent/30'
          : 'bg-stellar-surface border border-stellar-border'
      }`}>
        {isUser
          ? <User className="w-3 h-3 text-stellar-accent" />
          : <Bot className="w-3 h-3 text-stellar-muted" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed break-words ${
        isUser
          ? 'bg-stellar-accent/15 border border-stellar-accent/20 text-stellar-text'
          : message.isError
          ? 'bg-red-500/10 border border-red-500/20 text-red-400'
          : 'bg-stellar-surface border border-stellar-border text-stellar-text'
      }`}>
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <ReactMarkdown
            components={{
              // Code blocks
              code({ inline, className, children }) {
                const language = (className || '').replace('language-', '')
                if (inline) {
                  return (
                    <code className="px-1 py-0.5 bg-stellar-card border border-stellar-border rounded text-stellar-accent font-mono text-xs">
                      {children}
                    </code>
                  )
                }
                return <CodeBlock language={language}>{children}</CodeBlock>
              },

              // Headings
              h1: ({ children }) => (
                <h1 className="text-sm font-bold text-stellar-heading mt-3 mb-1.5 first:mt-0">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-xs font-bold text-stellar-heading mt-3 mb-1 first:mt-0 border-b border-stellar-border pb-1">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-xs font-semibold text-stellar-accent mt-2 mb-1 first:mt-0">{children}</h3>
              ),

              // Paragraphs
              p: ({ children }) => (
                <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
              ),

              // Lists
              ul: ({ children }) => (
                <ul className="mb-2 space-y-0.5 pl-3">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="mb-2 space-y-0.5 pl-3 list-decimal">{children}</ol>
              ),
              li: ({ children }) => (
                <li className="text-xs leading-relaxed before:content-['•'] before:text-stellar-accent before:mr-1.5 before:font-bold">
                  {children}
                </li>
              ),

              // Bold / italic
              strong: ({ children }) => (
                <strong className="font-semibold text-stellar-heading">{children}</strong>
              ),
              em: ({ children }) => (
                <em className="italic text-stellar-muted">{children}</em>
              ),

              // Blockquote
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-stellar-accent/50 pl-2.5 my-2 text-stellar-muted italic">
                  {children}
                </blockquote>
              ),

              // Horizontal rule
              hr: () => <hr className="border-stellar-border my-3" />,

              // Links
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer"
                  className="text-stellar-accent hover:underline">
                  {children}
                </a>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  )
}

export default function ChatPanel({ onClose }) {
  const [input, setInput] = useState('')
  const { messages, isLoading, sendMessage, clearMessages } = useChatStore()
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [input])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    await sendMessage(text)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full bg-stellar-bg border-l border-stellar-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-stellar-border bg-stellar-card flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-stellar-accent/20 border border-stellar-accent/30 flex items-center justify-center">
            <Bot className="w-3 h-3 text-stellar-accent" />
          </div>
          <span className="text-xs font-semibold text-stellar-heading">StellarAI</span>
          <span className="text-xs text-stellar-border">· Soroban assistant</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button onClick={clearMessages}
              className="p-1 text-stellar-border hover:text-stellar-muted rounded transition-colors"
              title="Clear conversation">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onClose}
            className="p-1 text-stellar-border hover:text-stellar-muted rounded transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-stellar-accent/10 border border-stellar-accent/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-stellar-accent" />
            </div>
            <div>
              <p className="text-xs font-semibold text-stellar-heading">StellarAI</p>
              <p className="text-xs text-stellar-muted mt-1 leading-relaxed">
                Ask me anything about Soroban contracts, Rust, or the Stellar ecosystem.
              </p>
            </div>
            <div className="flex flex-col gap-1.5 w-full">
              {[
                'Explain this contract code',
                'How do I emit events in Soroban?',
                'Show me a token contract example',
              ].map((s) => (
                <button key={s}
                  onClick={() => { setInput(s); inputRef.current?.focus() }}
                  className="text-xs text-left px-2.5 py-1.5 bg-stellar-surface border border-stellar-border hover:border-stellar-accent/40 rounded-md text-stellar-muted hover:text-stellar-text transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}

        {isLoading && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center bg-stellar-surface border border-stellar-border">
              <Bot className="w-3 h-3 text-stellar-muted" />
            </div>
            <div className="bg-stellar-surface border border-stellar-border rounded-lg px-3 py-2.5 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-stellar-muted animate-spin" />
              <span className="text-xs text-stellar-border">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-stellar-border flex-shrink-0">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask StellarAI…"
            rows={1}
            className="flex-1 resize-none bg-stellar-surface border border-stellar-border hover:border-stellar-accent/40 focus:border-stellar-accent/60 rounded-lg px-3 py-2 text-xs text-stellar-text placeholder-stellar-border outline-none transition-colors"
            style={{ overflowY: 'auto' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 w-8 h-8 bg-stellar-accent hover:bg-stellar-accent-hover disabled:opacity-40 text-white rounded-lg flex items-center justify-center transition-colors self-end">
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-xs text-stellar-border mt-1.5">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}
