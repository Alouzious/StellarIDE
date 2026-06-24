import { useEffect, useRef, useState } from 'react'
import { FileCode, X } from 'lucide-react'

function fileIcon(path) {
  if (path?.endsWith('.rs')) return 'text-orange-400'
  if (path?.endsWith('.toml')) return 'text-amber-400'
  if (path?.endsWith('.md')) return 'text-blue-400'
  if (path?.endsWith('.json')) return 'text-yellow-400'
  return 'text-stellar-muted'
}

export default function FileTabBar({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  onContextMenu,
}) {
  const scrollRef = useRef(null)

  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-active="true"]')
    el?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [activeTabId])

  if (!tabs.length) return null

  return (
    <div className="flex items-stretch border-b border-stellar-border bg-stellar-card h-9 flex-shrink-0 overflow-hidden">
      <div
        ref={scrollRef}
        className="flex items-stretch overflow-x-auto flex-1 min-w-0 scrollbar-thin"
        style={{
          maskImage: 'linear-gradient(to right, transparent 0, black 12px, black calc(100% - 12px), transparent 100%)',
        }}
      >
        {tabs.map((tab) => {
          const active = tab.fileId === activeTabId
          return (
            <button
              key={tab.fileId}
              type="button"
              data-active={active ? 'true' : 'false'}
              onClick={() => onSelect(tab.fileId)}
              onMouseDown={(e) => {
                if (e.button === 1) {
                  e.preventDefault()
                  onClose(tab.fileId)
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                onContextMenu?.(e, tab)
              }}
              className={`group flex items-center gap-1.5 px-3 h-full border-r border-stellar-border text-xs font-mono flex-shrink-0 max-w-[180px] transition-colors ${
                active
                  ? 'bg-stellar-surface text-stellar-text border-b-2 border-b-stellar-accent'
                  : 'bg-stellar-card text-stellar-muted hover:bg-stellar-surface/80 hover:text-stellar-text border-b-2 border-b-transparent'
              }`}
            >
              <FileCode className={`w-3.5 h-3.5 flex-shrink-0 ${fileIcon(tab.path)}`} />
              <span className="truncate">{tab.filename}</span>
              {tab.isDirty && (
                <span className="w-2 h-2 rounded-full bg-stellar-accent flex-shrink-0" title="Unsaved changes" />
              )}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  onClose(tab.fileId)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation()
                    onClose(tab.fileId)
                  }
                }}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-stellar-border/40 text-stellar-muted hover:text-white flex-shrink-0"
              >
                <X className="w-3 h-3" />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
