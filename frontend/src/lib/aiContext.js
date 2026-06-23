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
