import { getApiBaseUrl } from './api'

function getAuthToken() {
  try {
    const raw = localStorage.getItem('stellar-auth')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.state?.token || parsed?.token || null
  } catch {
    return null
  }
}

/**
 * POST to an SSE endpoint and invoke onLine for each `data:` payload.
 */
export async function streamSsePost(path, { body, onLine, signal } = {}) {
  const token = getAuthToken()
  const url = `${getApiBaseUrl()}/api/v1${path}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  })

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const data = await response.json()
      message = data.error || message
    } catch {
      // ignore parse errors
    }
    throw new Error(message)
  }

  if (!response.body) {
    throw new Error('Streaming not supported in this browser')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const processEventBlock = (block) => {
    for (const line of block.split('\n')) {
      if (line.startsWith('data:')) {
        const data = line.slice(5).trimStart()
        if (data) onLine?.(data)
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let boundary = buffer.indexOf('\n\n')
    while (boundary !== -1) {
      processEventBlock(buffer.slice(0, boundary))
      buffer = buffer.slice(boundary + 2)
      boundary = buffer.indexOf('\n\n')
    }
  }

  if (buffer.trim()) {
    processEventBlock(buffer)
  }
}
