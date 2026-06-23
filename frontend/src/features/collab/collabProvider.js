import * as Y from 'yjs'
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'

const MAX_RECONNECT_ATTEMPTS = 10
const BASE_RECONNECT_MS = 1000
const MAX_RECONNECT_MS = 30000
const PING_INTERVAL_MS = 30000

function toBase64(bytes) {
  let binary = ''
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i])
  return btoa(binary)
}

function fromBase64(b64) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function jitter(ms) {
  return ms + Math.floor(Math.random() * 500)
}

function removeAwarenessForUser(awareness, userId) {
  const toRemove = []
  awareness.getStates().forEach((state, clientId) => {
    if (state?.user?.userId === userId) toRemove.push(clientId)
  })
  if (toRemove.length > 0) {
    removeAwarenessStates(awareness, toRemove, 'remote-leave')
  }
}

function getOrCreateConnectionId() {
  const key = 'stellar-collab-conn-id'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
  }
  return id
}

/**
 * Shared reconnect/backoff + ping keepalive for collab WebSockets.
 */
class CollabWebSocket {
  constructor({ buildUrl, onMessage, onStatus, onMaxRetries, onSessionRestored, label }) {
    this.buildUrl = buildUrl
    this.onMessage = onMessage
    this.onStatus = onStatus
    this.onMaxRetries = onMaxRetries
    this.onSessionRestored = onSessionRestored
    this.label = label
    this.ws = null
    this.destroyed = false
    this.shouldReconnect = true
    this.reconnectTimer = null
    this.pingTimer = null
    this.reconnectAttempts = 0
    this.connectionId = getOrCreateConnectionId()
    this._connect()
  }

  _setStatus(status) {
    this.onStatus?.(status, this.label)
  }

  _backoffMs() {
    const exp = Math.min(
      BASE_RECONNECT_MS * 2 ** this.reconnectAttempts,
      MAX_RECONNECT_MS
    )
    return jitter(exp)
  }

  _connect() {
    if (this.destroyed) return
    this._setStatus('connecting')

    const url = this.buildUrl(this.connectionId)
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      const wasReconnect = this.reconnectAttempts > 0
      this.reconnectAttempts = 0
      this._setStatus('connected')
      this._startPing()
      if (wasReconnect) {
        this.onSessionRestored?.('restored')
      }
    }

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        this.onMessage?.(msg)
      } catch {
        // ignore malformed
      }
    }

    this.ws.onclose = () => {
      this._stopPing()
      if (this.destroyed) {
        this._setStatus('disconnected')
        return
      }
      this._setStatus('reconnecting')
      if (this.shouldReconnect) {
        this.reconnectAttempts += 1
        if (this.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
          this._setStatus('disconnected')
          this.onMaxRetries?.()
          return
        }
        this.reconnectTimer = setTimeout(() => this._connect(), this._backoffMs())
      } else {
        this._setStatus('disconnected')
      }
    }

    this.ws.onerror = () => {
      this._setStatus('error')
    }
  }

  _startPing() {
    this._stopPing()
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Browser WebSocket API sends ping frames automatically in some envs;
        // send a lightweight JSON ping the server can ignore.
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }))
        } catch { /* ignore */ }
      }
    }, PING_INTERVAL_MS)
  }

  _stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  send(payload) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
    }
  }

  destroy() {
    this.destroyed = true
    this.shouldReconnect = false
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this._stopPing()
    this.ws?.close()
    this.ws = null
    this._setStatus('disconnected')
  }
}

/**
 * Custom Yjs WebSocket provider for StellarIDE's JSON collab protocol.
 */
export class StellarCollabProvider {
  constructor({ url, ydoc, awareness, userId, fallbackText, onStatus, onSynced, onSessionRestored }) {
    this.url = url
    this.ydoc = ydoc
    this.awareness = awareness
    this.userId = userId
    this.fallbackText = fallbackText || ''
    this.onStatus = onStatus
    this.onSynced = onSynced
    this.onSessionRestored = onSessionRestored
    this.synced = false
    this.destroyed = false
    this.serverSnapshotApplied = false

    this._onDocUpdate = (update, origin) => {
      if (origin === this || this.destroyed) return
      this._socket?.send({
        type: 'doc_update',
        user_id: this.userId,
        data: toBase64(update),
      })
    }

    this._onAwarenessUpdate = ({ added, updated, removed }) => {
      if (this.destroyed) return
      const changed = added.concat(updated, removed)
      if (changed.length === 0) return
      const update = encodeAwarenessUpdate(this.awareness, changed)
      this._socket?.send({
        type: 'awareness_update',
        user_id: this.userId,
        data: toBase64(update),
      })
    }

    ydoc.on('update', this._onDocUpdate)
    awareness.on('update', this._onAwarenessUpdate)

    this._socket = new CollabWebSocket({
      buildUrl: (connId) => `${url}${url.includes('?') ? '&' : '?'}conn_id=${encodeURIComponent(connId)}`,
      onMessage: (msg) => this._handleMessage(msg),
      onStatus: (status) => this.onStatus?.(status),
      onMaxRetries: () => this.onSessionRestored?.('disconnected'),
      onSessionRestored: this.onSessionRestored,
      label: 'file',
    })
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'doc_update': {
        if (msg.user_id === this.userId) return
        const bytes = fromBase64(msg.data)
        const isServerSnapshot =
          !msg.user_id || msg.user_id === '00000000-0000-0000-0000-000000000000'

        if (isServerSnapshot && !this.serverSnapshotApplied) {
          this.serverSnapshotApplied = true
          try {
            Y.applyUpdate(this.ydoc, bytes, this)
            if (!this.synced) {
              this.synced = true
              this.onSynced?.()
            }
          } catch {
            // Server sent plain-text fallback (empty room).
            this._applyFallbackText()
          }
          // If Yjs state applied but document is still empty, use DB fallback.
          const ytext = this.ydoc.getText('monaco')
          if (ytext.length === 0 && this.fallbackText) {
            this._applyFallbackText()
          }
          return
        }

        Y.applyUpdate(this.ydoc, bytes, this)
        if (!this.synced) {
          this.synced = true
          this.onSynced?.()
        }
        break
      }
      case 'awareness_update': {
        if (msg.user_id === this.userId) return
        applyAwarenessUpdate(this.awareness, fromBase64(msg.data), this)
        break
      }
      case 'awareness_remove':
      case 'leave': {
        if (msg.user_id) removeAwarenessForUser(this.awareness, msg.user_id)
        break
      }
      case 'session_restored': {
        this.onSessionRestored?.('restored')
        break
      }
      default:
        break
    }
  }

  _applyFallbackText() {
    const ytext = this.ydoc.getText('monaco')
    if (this.fallbackText && ytext.length === 0) {
      ytext.insert(0, this.fallbackText)
    }
    if (!this.synced) {
      this.synced = true
      this.onSynced?.()
    }
  }

  destroy() {
    this.destroyed = true
    this.ydoc.off('update', this._onDocUpdate)
    this.awareness.off('update', this._onAwarenessUpdate)
    this._socket?.send({ type: 'leave', user_id: this.userId })
    this._socket?.destroy()
    this._socket = null
  }
}

export function createCollabSession({
  url,
  userId,
  userName,
  userColor,
  fallbackText,
  onStatus,
  onSynced,
  onSessionRestored,
}) {
  const ydoc = new Y.Doc()
  const awareness = new Awareness(ydoc)

  awareness.setLocalStateField('user', {
    name: userName,
    color: userColor,
    userId,
  })

  // Do NOT pre-seed ytext — wait for server snapshot, then fall back to DB text.
  const provider = new StellarCollabProvider({
    url,
    ydoc,
    awareness,
    userId,
    fallbackText,
    onStatus,
    onSynced,
    onSessionRestored,
  })

  return { ydoc, ytext: ydoc.getText('monaco'), awareness, provider }
}

export class ProjectCollabProvider {
  constructor({
    url,
    userId,
    onFileTreeUpdate,
    onFileTreeError,
    onPresence,
    onStatus,
    onCompileOutput,
    onTestOutput,
    onTerminalStarted,
    onTerminalOutput,
    onTerminalDone,
    onDeployStarted,
    onDeployFinished,
    onSessionRestored,
  }) {
    this.userId = userId
    this.onFileTreeUpdate = onFileTreeUpdate
    this.onFileTreeError = onFileTreeError
    this.onPresence = onPresence
    this.onStatus = onStatus
    this.onCompileOutput = onCompileOutput
    this.onTestOutput = onTestOutput
    this.onTerminalStarted = onTerminalStarted
    this.onTerminalOutput = onTerminalOutput
    this.onTerminalDone = onTerminalDone
    this.onDeployStarted = onDeployStarted
    this.onDeployFinished = onDeployFinished
    this.onSessionRestored = onSessionRestored
    this.destroyed = false

    this._socket = new CollabWebSocket({
      buildUrl: (connId) => `${url}${url.includes('?') ? '&' : '?'}conn_id=${encodeURIComponent(connId)}`,
      onMessage: (msg) => this._handleMessage(msg),
      onStatus: (status) => this.onStatus?.(status),
      onMaxRetries: () => this.onSessionRestored?.('disconnected'),
      onSessionRestored: this.onSessionRestored,
      label: 'project',
    })
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'file_tree_update':
        if (msg.user_id !== this.userId) this.onFileTreeUpdate?.(msg)
        break
      case 'file_tree_error':
        if (msg.user_id === this.userId) this.onFileTreeError?.(msg)
        break
      case 'presence':
        this.onPresence?.(msg.users)
        break
      case 'compile_output':
        this.onCompileOutput?.(msg)
        break
      case 'test_output':
        this.onTestOutput?.(msg)
        break
      case 'terminal_started':
        this.onTerminalStarted?.(msg)
        break
      case 'terminal_output':
        this.onTerminalOutput?.(msg)
        break
      case 'terminal_done':
        this.onTerminalDone?.(msg)
        break
      case 'deploy_started':
        this.onDeployStarted?.(msg)
        break
      case 'deploy_finished':
        this.onDeployFinished?.(msg)
        break
      case 'session_restored':
        this.onSessionRestored?.('restored')
        break
      default:
        break
    }
  }

  sendFileTreeUpdate(payload) {
    this._socket?.send({ type: 'file_tree_update', user_id: this.userId, ...payload })
  }

  destroy() {
    this.destroyed = true
    this._socket?.destroy()
    this._socket = null
  }
}

export { Y, Awareness, encoding, decoding, getOrCreateConnectionId }
