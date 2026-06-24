import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

const THEME = {
  background: '#0d1117',
  foreground: '#e6edf3',
  cursor: '#58a6ff',
  black: '#484f58',
  red: '#ff7b72',
  green: '#3fb950',
  yellow: '#d29922',
  blue: '#58a6ff',
}

export default function SharedTerminalView({ userName, chunks }) {
  const containerRef = useRef(null)
  const termRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    const term = new XTerm({
      theme: THEME,
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      fontSize: 13,
      scrollback: 5000,
      disableStdin: true,
      cursorBlink: false,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    fit.fit()
    term.writeln(`\x1b[33mShared terminal from ${userName || 'collaborator'} (read-only)\x1b[0m`)
    termRef.current = term

    const ro = new ResizeObserver(() => fit.fit())
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      term.dispose()
    }
  }, [userName])

  useEffect(() => {
    if (!termRef.current || !chunks?.length) return
    chunks.forEach((chunk) => {
      try {
        const bytes = Uint8Array.from(atob(chunk), (c) => c.charCodeAt(0))
        termRef.current.write(bytes)
      } catch {
        termRef.current.write(chunk)
      }
    })
  }, [chunks])

  return <div ref={containerRef} className="h-full w-full bg-[#0d1117] p-1" />
}
