export function extractSdkVersion(files) {
  const cargo = files.find((f) => f.file_path === 'Cargo.toml' || f.file_path?.endsWith('/Cargo.toml'))
  if (!cargo?.content) return '22.0.11'
  const match = cargo.content.match(/soroban-sdk\s*=\s*["']?([^"'\n]+)/)
  return match?.[1]?.trim() || '22.0.11'
}

export function buildTerminalOutput(outputLog) {
  return outputLog.map((l) => l.line).join('\n')
}

export function buildErrorOutput(outputLog) {
  return outputLog
    .filter((l) => l.level === 'error' || l.level === 'warning')
    .map((l) => l.line)
    .join('\n')
}

export function buildExplainChatMessage({ activeFile, editorContent, outputLog }) {
  const activePath = activeFile?.file_path || 'src/lib.rs'
  const errors = buildErrorOutput(outputLog)
  const terminal = buildTerminalOutput(outputLog)
  const codeSnippet = (editorContent || '').slice(0, 6000)

  if (errors.trim()) {
    return (
      `Please explain the errors in my terminal output and help me understand how to fix them.\n\n` +
      `Active file: \`${activePath}\`\n\n` +
      `**Errors:**\n\`\`\`\n${errors.slice(-3000)}\n\`\`\`\n\n` +
      `**Recent terminal output:**\n\`\`\`\n${terminal.slice(-4000)}\n\`\`\`\n\n` +
      `**Current file (\`${activePath}\`):**\n\`\`\`rust\n${codeSnippet}\n\`\`\``
    )
  }

  return (
    `Please explain my Soroban smart contract. Walk through what the code does, ` +
    `key Soroban concepts, and anything I should know before deploying.\n\n` +
    `File: \`${activePath}\`\n\n` +
    `\`\`\`rust\n${codeSnippet}\n\`\`\`\n\n` +
    (terminal.trim()
      ? `**Terminal output:**\n\`\`\`\n${terminal.slice(-2000)}\n\`\`\``
      : '')
  )
}

export function buildAiContext(state, network = 'testnet') {
  const {
    activeFile,
    editorContent,
    files,
    outputLog,
    auditFindings,
  } = state

  const activePath = activeFile?.file_path || 'src/lib.rs'
  const projectFiles = files
    .filter((f) => f.language !== 'wasm' && !f.file_path?.endsWith('.wasm'))
    .map((f) => ({
      path: f.file_path,
      content: f.file_path === activePath ? editorContent : (f.content || ''),
    }))

  return {
    active_file: activePath,
    active_content: editorContent,
    files: projectFiles,
    terminal_output: buildTerminalOutput(outputLog),
    errors: buildErrorOutput(outputLog),
    audit_findings: (auditFindings || []).map((f) => ({
      severity: f.severity,
      title: f.title,
      description: f.description,
      file: f.file,
      line_start: f.line_start,
      recommendation: f.recommendation,
    })),
    network,
    sdk_version: extractSdkVersion(files),
  }
}

export function simpleDiffLines(before, after) {
  const a = (before || '').split('\n')
  const b = (after || '').split('\n')
  const max = Math.max(a.length, b.length)
  const lines = []
  for (let i = 0; i < max; i++) {
    const left = a[i]
    const right = b[i]
    if (left === right) {
      if (left !== undefined) lines.push({ type: 'same', text: left })
    } else {
      if (left !== undefined) lines.push({ type: 'removed', text: left })
      if (right !== undefined) lines.push({ type: 'added', text: right })
    }
  }
  return lines
}
