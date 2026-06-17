import * as Y from 'yjs'
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'

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

/**
 * Custom Yjs WebSocket provider for StellarIDE's JSON collab protocol.
 * Compatible with y-monaco + y-protocols awareness.
 */
export class StellarCollabProvider {
  constructor({ url, ydoc, awareness, userId, onStatus, onSynced }) {
    this.url = url
    this.ydoc = ydoc
    this.awareness = awareness
    this.userId = userId
    this.onStatus = onStatus
    this.onSynced = onSynced
    this.ws = null
    this.synced = false
    this.destroyed = false
    this.reconnectTimer = null
    this.shouldReconnect = true

    this._onDocUpdate = (update, origin) => {
      if (origin === this || this.destroyed) return
      this._send({
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
      this._send({
        type: 'awareness_update',
        user_id: this.userId,
        data: toBase64(update),
      })
    }

    ydoc.on('update', this._onDocUpdate)
    awareness.on('update', this._onAwarenessUpdate)
    this._connect()
  }

  _connect() {
    if (this.destroyed) return
    this.onStatus?.('connecting')

    this.ws = new WebSocket(this.url)

    this.ws.onopen = () => {
      this.onStatus?.('connected')
    }

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        this._handleMessage(msg)
      } catch {
        // ignore malformed
      }
    }

    this.ws.onclose = () => {
      this.onStatus?.('disconnected')
      if (this.shouldReconnect && !this.destroyed) {
        this.reconnectTimer = setTimeout(() => this._connect(), 2000)
      }
    }

    this.ws.onerror = () => {
      this.onStatus?.('error')
    }
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'doc_update': {
        if (msg.user_id === this.userId) return
        const bytes = fromBase64(msg.data)
        // Initial seed from server uses nil user_id with plain text
        if (!msg.user_id || msg.user_id === '00000000-0000-0000-0000-000000000000') {
          try {
            Y.applyUpdate(this.ydoc, bytes, this)
            if (!this.synced) {
              this.synced = true
              this.onSynced?.()
            }
          } catch {
            const text = new TextDecoder().decode(bytes)
            const ytext = this.ydoc.getText('monaco')
            ytext.delete(0, ytext.length)
            ytext.insert(0, text)
            if (!this.synced) {
              this.synced = true
              this.onSynced?.()
            }
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
        const update = fromBase64(msg.data)
        applyAwarenessUpdate(this.awareness, update, this)
        break
      }
      default:
        break
    }
  }

  _send(payload) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
    }
  }

  destroy() {
    this.destroyed = true
    this.shouldReconnect = false
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ydoc.off('update', this._onDocUpdate)
    this.awareness.off('update', this._onAwarenessUpdate)
    this._send({ type: 'leave', user_id: this.userId })
    this.ws?.close()
    this.ws = null
  }
}

export function createCollabSession({ url, userId, userName, userColor, initialText }) {
  const ydoc = new Y.Doc()
  const awareness = new Awareness(ydoc)

  awareness.setLocalStateField('user', {
    name: userName,
    color: userColor,
  })

  const ytext = ydoc.getText('monaco')
  if (initialText) {
    ytext.insert(0, initialText)
  }

  const provider = new StellarCollabProvider({
    url,
    ydoc,
    awareness,
    userId,
  })

  return { ydoc, ytext, awareness, provider }
}

export class ProjectCollabProvider {
  constructor({ url, userId, onFileTreeUpdate, onPresence, onStatus }) {
    this.url = url
    this.userId = userId
    this.onFileTreeUpdate = onFileTreeUpdate
    this.onPresence = onPresence
    this.onStatus = onStatus
    this.ws = null
    this.destroyed = false
    this.shouldReconnect = true
    this.reconnectTimer = null
    this._connect()
  }

  _connect() {
    if (this.destroyed) return
    this.onStatus?.('connecting')
    this.ws = new WebSocket(this.url)

    this.ws.onopen = () => this.onStatus?.('connected')
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'file_tree_update' && msg.user_id !== this.userId) {
          this.onFileTreeUpdate?.(msg)
        }
        if (msg.type === 'presence') {
          this.onPresence?.(msg.users)
        }
        if (msg.type === 'join' && msg.user_id !== this.userId) {
          // presence will follow
        }
        if (msg.type === 'leave') {
          // presence will follow
        }
      } catch { /* ignore */ }
    }
    this.ws.onclose = () => {
      this.onStatus?.('disconnected')
      if (this.shouldReconnect && !this.destroyed) {
        this.reconnectTimer = setTimeout(() => this._connect(), 2000)
      }
    }
  }

  sendFileTreeUpdate(payload) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'file_tree_update', user_id: this.userId, ...payload }))
    }
  }

  destroy() {
    this.destroyed = true
    this.shouldReconnect = false
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
  }
}

export { Y, Awareness, encoding, decoding }
