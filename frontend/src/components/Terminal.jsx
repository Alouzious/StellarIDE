import { useCallback, useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import { getWsBaseUrl } from '../services/api'
import useSettingsStore from '../features/settings/settingsStore'
import { terminalThemeForApp } from '../lib/terminalThemes'

function sendResize(ws, cols, rows) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify({ type: 'resize', cols, rows }))
}

function sendShare(ws, enabled) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify({ type: 'share', enabled }))
}

export default function Terminal({
  projectId,
  token,
  sessionId,
  projectName,
  readOnly = false,
  shareEnabled = false,
  onShareChange,
  onStatusChange,
  reconnectKey = 0,
}) {
  const containerRef = useRef(null)
  const termRef = useRef(null)
  const fitRef = useRef(null)
  const searchRef = useRef(null)
  const wsRef = useRef(null)
  const mountedRef = useRef(true)
  const reconnectTimerRef = useRef(null)
  const dataDisposableRef = useRef(null)
  const keyDisposableRef = useRef(null)
  const shareRef = useRef(shareEnabled)
  const settings = useSettingsStore()

  useEffect(() => {
    shareRef.current = shareEnabled
    sendShare(wsRef.current, shareEnabled)
  }, [shareEnabled])

  const connect = useCallback(() => {
    if (!projectId || !token || !sessionId || !termRef.current) return

    const term = termRef.current
    const fitAddon = fitRef.current
    if (!fitAddon) return

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    onStatusChange?.('connecting')
    const url = `${getWsBaseUrl()}/api/v1/terminal/${projectId}?token=${encodeURIComponent(token)}&session=${encodeURIComponent(sessionId)}`
    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      onStatusChange?.('connected')
      fitAddon.fit()
      const { cols, rows } = term
      sendResize(ws, cols, rows)
      sendShare(ws, shareRef.current)
    }

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') return
      const bytes = new Uint8Array(event.data)
      term.write(bytes)
    }

    ws.onerror = () => {
      onStatusChange?.('error')
      term.writeln('\r\n\x1b[31m[connection error]\x1b[0m Reconnecting in 2s…')
    }

    ws.onclose = () => {
      onStatusChange?.('disconnected')
      if (wsRef.current === ws) wsRef.current = null
      if (!mountedRef.current) return
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current && termRef.current) connect()
      }, 2000)
    }
  }, [projectId, token, sessionId, onStatusChange])

  useEffect(() => {
    mountedRef.current = true
    if (!containerRef.current) return

    const term = new XTerm({
      theme: terminalThemeForApp(settings.theme),
      fontFamily: settings.terminalFontFamily,
      fontSize: settings.terminalFontSize,
      scrollback: settings.terminalScrollback,
      lineHeight: 1.5,
      cursorBlink: true,
      cursorStyle: 'block',
      convertEol: true,
      disableStdin: readOnly,
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    term.loadAddon(searchAddon)
    term.open(containerRef.current)

    termRef.current = term
    fitRef.current = fitAddon
    searchRef.current = searchAddon

    if (!readOnly) {
      dataDisposableRef.current = term.onData((data) => {
        const ws = wsRef.current
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(new TextEncoder().encode(data))
        }
      })
    }

    keyDisposableRef.current = term.onKey(({ domEvent }) => {
      if (domEvent.ctrlKey && domEvent.shiftKey && domEvent.key === 'C') {
        const selection = term.getSelection()
        if (selection) navigator.clipboard.writeText(selection)
      }
      if (domEvent.ctrlKey && domEvent.shiftKey && domEvent.key === 'V') {
        navigator.clipboard.readText().then((text) => {
          if (readOnly) return
          const ws = wsRef.current
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(new TextEncoder().encode(text))
          }
        }).catch(() => {})
      }
      if (domEvent.ctrlKey && domEvent.key === 'l') {
        domEvent.preventDefault()
        term.clear()
      }
      if (domEvent.ctrlKey && domEvent.shiftKey && domEvent.key === 'F') {
        domEvent.preventDefault()
        const query = window.prompt('Search terminal')
        if (query) searchAddon.findNext(query)
      }
    })

    const ro = new ResizeObserver(() => {
      fitAddon.fit()
      const ws = wsRef.current
      if (ws?.readyState === WebSocket.OPEN) {
        sendResize(ws, term.cols, term.rows)
      }
    })
    ro.observe(containerRef.current)

    connect()

    return () => {
      mountedRef.current = false
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      ro.disconnect()
      dataDisposableRef.current?.dispose()
      keyDisposableRef.current?.dispose()
      wsRef.current?.close()
      wsRef.current = null
      term.dispose()
      termRef.current = null
      fitRef.current = null
      searchRef.current = null
    }
  }, [connect, readOnly, reconnectKey, settings.theme, settings.terminalFontSize, settings.terminalFontFamily, settings.terminalScrollback])

  useEffect(() => {
    if (projectName && termRef.current) {
      // welcome is printed by backend .bashrc
    }
  }, [projectName])

  return (
    <div className="h-full w-full bg-[#0d1117] p-1">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}

export { sendShare }
