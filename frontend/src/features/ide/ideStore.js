import { create } from 'zustand'
import api from '../../services/api'
import { streamSsePost } from '../../services/sseStream'
import { Keypair } from '@stellar/stellar-sdk'
import { deployContractWithWallet } from '../../lib/sorobanDeploy'
import { buildAiContext } from '../../lib/aiContext'

function inferLogLevel(line) {
  const lower = `${line}`.toLowerCase()
  if (lower.includes('error') || line.startsWith('✖') || line.startsWith('✗')) return 'error'
  if (lower.includes('warning') || line.startsWith('⚠')) return 'warning'
  if (/finished|✓|✔|success/i.test(line)) return 'success'
  if (/compiling|running/i.test(line)) return 'running'
  return 'info'
}

function formatTimestamp() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false })
}

const DEFAULT_LIB_CONTENT = `#![no_std]
use soroban_sdk::{contract, contractimpl, vec, Env, Symbol, symbol_short, Vec};

#[contract]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {
        vec![&env, symbol_short!("Hello"), to]
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test() {
        let env = Env::default();
        let contract_id = env.register(HelloContract, ());
        let client = HelloContractClient::new(&env, &contract_id);
        let words = client.hello(&symbol_short!("Dev"));
        assert_eq!(
            words,
            vec![&env, symbol_short!("Hello"), symbol_short!("Dev"),]
        );
    }
}
`

const DEFAULT_CARGO_TOML = `[package]
name = "stellaride_contract"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = "22.0.11"

[dev-dependencies]
soroban-sdk = { version = "22.0.11", features = ["testutils"] }
`

let _logId = 0
const nextLogId = () => ++_logId

function computeClientRiskLevel(findings) {
  if (!findings?.length) return 'CLEAN'
  if (findings.some((f) => f.severity === 'Critical' || f.severity === 'High')) return 'HIGH RISK'
  if (findings.some((f) => f.severity === 'Medium')) return 'MEDIUM RISK'
  return 'LOW RISK'
}

const useIdeStore = create((set, get) => ({
  project: null,
  files: [],
  activeFile: null,
  editorContent: DEFAULT_LIB_CONTENT,
  outputLog: [],
  terminalOperation: null,
  streamAbortController: null,
  compileStatus: 'idle',
  testStatus: 'idle',
  deployStatus: 'idle',
  verifyStatus: 'idle',
  verifyResult: null,
  verifyError: null,
  auditStatus: 'idle',
  auditFindings: [],
  auditRiskLevel: 'CLEAN',
  auditMessage: '',
  auditPanelOpen: false,
  auditShowTerminal: false,
  editorHighlight: null,
  isSaving: false,

  openTabs: [],
  activeTabId: null,
  savedSnapshots: {},
  closedTabsStack: [],

  aiStatus: 'idle',
  aiExplainPanelOpen: false,
  aiExplainContent: '',
  aiExplainFile: '',
  aiExplainStatus: 'idle',
  aiExplainError: null,
  aiFixPanelOpen: false,
  aiFixProposal: null,
  aiFixStatus: 'idle',
  aiFixError: null,

  // Generated wallet (keypair lives in browser only, never sent to DB)
  generatedWallet: null, // { publicKey, secretKey }
  walletBalance: '0',
  walletFunded: false,

  // Freighter wallet (future)
  wallet: { provider: 'freighter', connected: false, address: null, error: null },

  setProject: (project) => set({ project }),

  syncEditorToFiles: () => {
    const { activeTabId, activeFile, editorContent, files } = get()
    const path = activeTabId || activeFile?.file_path
    if (!path) return
    set({
      files: files.map((f) =>
        f.file_path === path ? { ...f, content: editorContent } : f
      ),
      activeFile: activeFile?.file_path === path
        ? { ...activeFile, content: editorContent }
        : activeFile,
    })
  },

  tabMeta: (file) => ({
    fileId: file.file_path,
    filename: (file.file_path || 'file').split('/').pop(),
    path: file.file_path,
    isDirty: false,
  }),

  markTabDirty: (fileId) => {
    if (!fileId) return
    set((state) => ({
      openTabs: state.openTabs.map((t) =>
        t.fileId === fileId ? { ...t, isDirty: true } : t
      ),
    }))
  },

  markTabClean: (fileId) => {
    if (!fileId) return
    const path = fileId
    set((state) => ({
      openTabs: state.openTabs.map((t) =>
        t.fileId === fileId ? { ...t, isDirty: false } : t
      ),
      savedSnapshots: { ...state.savedSnapshots, [path]: get().editorContent },
    }))
  },

  openTab: (file) => {
    if (!file?.file_path) return
    const state = get()
    state.syncEditorToFiles()
    const fileId = file.file_path
    const exists = state.openTabs.some((t) => t.fileId === fileId)
    const openTabs = exists
      ? state.openTabs
      : [...state.openTabs, state.tabMeta(file)]
    const target = state.files.find((f) => f.file_path === fileId) || file
    set({
      openTabs,
      activeTabId: fileId,
      activeFile: target,
      editorContent: target.content ?? '',
      savedSnapshots: state.savedSnapshots[fileId] === undefined
        ? { ...state.savedSnapshots, [fileId]: target.content ?? '' }
        : state.savedSnapshots,
    })
  },

  setActiveTab: (fileId) => {
    const state = get()
    if (!fileId || state.activeTabId === fileId) return
    state.syncEditorToFiles()
    const file = state.files.find((f) => f.file_path === fileId)
    if (!file) return
    set({
      activeTabId: fileId,
      activeFile: file,
      editorContent: file.content ?? '',
    })
  },

  closeTab: (fileId, { force = false } = {}) => {
    const state = get()
    const tab = state.openTabs.find((t) => t.fileId === fileId)
    if (!tab) return { closed: false }
    if (tab.isDirty && !force) return { closed: false, needsSave: true }

    const remaining = state.openTabs.filter((t) => t.fileId !== fileId)
    const closedTabsStack = [{ ...tab, file: state.files.find((f) => f.file_path === fileId) }, ...state.closedTabsStack].slice(0, 10)

    if (state.activeTabId === fileId) {
      const idx = state.openTabs.findIndex((t) => t.fileId === fileId)
      const next = remaining[Math.max(0, idx - 1)] || remaining[0]
      set({ openTabs: remaining, closedTabsStack, activeTabId: next?.fileId || null })
      if (next) {
        get().setActiveTab(next.fileId)
      } else {
        set({ activeFile: null, editorContent: '' })
      }
    } else {
      set({ openTabs: remaining, closedTabsStack })
    }
    return { closed: true }
  },

  closeOtherTabs: (fileId) => {
    const state = get()
    const keep = state.openTabs.filter((t) => t.fileId === fileId)
    set({ openTabs: keep })
    if (state.activeTabId !== fileId) get().setActiveTab(fileId)
  },

  closeAllTabs: () => {
    const dirty = get().openTabs.some((t) => t.isDirty)
    if (dirty) return { closed: false, needsSave: true }
    set({ openTabs: [], activeTabId: null, activeFile: null, editorContent: '' })
    return { closed: true }
  },

  reopenLastClosedTab: () => {
    const [last, ...rest] = get().closedTabsStack
    if (!last?.file) return false
    set({ closedTabsStack: rest })
    get().openTab(last.file)
    return true
  },

  loadFiles: async (projectId) => {
    try {
      const { data } = await api.get(`/projects/${projectId}/files`)
      const hasCargoToml = data.some(f => f.file_path === 'Cargo.toml')
      const hasLib = data.some(f => f.file_path === 'src/lib.rs' || f.file_path === 'lib.rs')

      let files = [...data]

      if (!hasLib) {
        files = [{
          id: 'virtual-lib-rs',
          project_id: projectId,
          file_path: 'src/lib.rs',
          content: DEFAULT_LIB_CONTENT,
          language: 'rust',
        }, ...files]
      }

      if (!hasCargoToml) {
        files = [...files, {
          id: 'virtual-cargo-toml',
          project_id: projectId,
          file_path: 'Cargo.toml',
          content: DEFAULT_CARGO_TOML,
          language: 'toml',
        }]
      }

      set({ files })
      if (files.length > 0) {
        const libFile = files.find(f => f.file_path === 'src/lib.rs' || f.file_path === 'lib.rs')
        const activeFile = libFile || files[0]
        const snapshots = {}
        files.forEach((f) => { snapshots[f.file_path] = f.content ?? '' })
        set({ savedSnapshots: snapshots })
        get().openTab(activeFile)
      }
    } catch {
      // no files yet
    }
  },

  setActiveFile: (file) => get().openTab(file),

  setEditorContent: (content) =>
    set((state) => {
      const path = state.activeTabId || state.activeFile?.file_path
      const saved = path ? state.savedSnapshots[path] : undefined
      const isDirty = path ? content !== saved : false
      return {
        editorContent: content,
        activeFile: state.activeFile ? { ...state.activeFile, content } : state.activeFile,
        files: path
          ? state.files.map((f) => (f.file_path === path ? { ...f, content } : f))
          : state.files,
        openTabs: path
          ? state.openTabs.map((t) =>
              t.fileId === path ? { ...t, isDirty } : t
            )
          : state.openTabs,
      }
    }),

  saveFile: async (projectId) => {
    const { activeFile, editorContent } = get()
    if (!projectId) return { success: false }
    if (activeFile?.language === 'wasm' || activeFile?.file_path?.endsWith('.wasm'))
      return { success: true }
    set({ isSaving: true })
    try {
      const filePath = activeFile?.file_path || 'src/lib.rs'
      const language = filePath.endsWith('.toml') ? 'toml' : 'rust'
      await api.post(`/projects/${projectId}/files`, {
        file_path: filePath,
        content: editorContent,
        language,
      })
      set((state) => ({
        isSaving: false,
        files: state.files.map((f) =>
          f.file_path === filePath ? { ...f, content: editorContent } : f
        ),
      }))
      get().markTabClean(filePath)
      return { success: true }
    } catch {
      set({ isSaving: false })
      return { success: false }
    }
  },

  saveAllFiles: async (projectId) => {
    const { files, activeFile, editorContent } = get()
    if (!projectId) return { success: false }
    set({ isSaving: true })
    try {
      const toSave = files.map((f) =>
        f.file_path === activeFile?.file_path ? { ...f, content: editorContent } : f
      )
      for (const f of toSave) {
        if (f.language === 'wasm' || f.file_path?.endsWith('.wasm')) continue
        const language = f.file_path?.endsWith('.toml') ? 'toml' : f.language || 'rust'
        await api.post(`/projects/${projectId}/files`, {
          file_path: f.file_path,
          content: f.content,
          language,
        })
      }
      set({ files: toSave, isSaving: false })
      return { success: true }
    } catch {
      set({ isSaving: false })
      return { success: false }
    }
  },

  pushToGitHub: async (projectId, message, options = {}) => {
    const { appendLog } = get()
    const { branch, openPr, prBase, prTitle } = options
    appendLog(`$ git push${branch ? ` origin ${branch}` : ''}: "${message}"`, 'info')
    try {
      const { data } = await api.post(`/projects/${projectId}/github/push`, {
        message,
        branch: branch || undefined,
        open_pr: openPr || undefined,
        pr_base: prBase || undefined,
        pr_title: prTitle || undefined,
      })
      appendLog(`✔  Pushed ${data.files_pushed} file(s) to GitHub`, 'success')
      if (data.files_deleted > 0) {
        appendLog(`   Deleted ${data.files_deleted} file(s) on remote`, 'info')
      }
      appendLog(`   Commit: ${data.commit_sha?.slice(0, 8)}`, 'info')
      if (data.pr_url) appendLog(`   Pull request: ${data.pr_url}`, 'success')
      if (data.pr_error) appendLog(`   PR note: ${data.pr_error}`, 'error')
      return { success: true, data }
    } catch (err) {
      const status = err.response?.status
      const msg = err.response?.data?.error || 'Push to GitHub failed'
      appendLog(`✖  ${msg}`, 'error')
      return { success: false, error: msg, conflict: status === 409 }
    }
  },

  fetchGitHubDiff: async (projectId, branch) => {
    try {
      const params = branch ? { branch } : {}
      const { data } = await api.get(`/projects/${projectId}/github/diff`, { params })
      return { success: true, diff: data }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to compute changes'
      return { success: false, error: msg }
    }
  },

  fetchPushHistory: async (projectId) => {
    try {
      const { data } = await api.get(`/projects/${projectId}/github/pushes`)
      return { success: true, pushes: data.pushes || [] }
    } catch {
      return { success: false, pushes: [] }
    }
  },

  appendLog: (line, level) =>
    set((state) => ({
      outputLog: [
        ...state.outputLog,
        {
          id: nextLogId(),
          line,
          level: level || inferLogLevel(line),
          timestamp: formatTimestamp(),
        },
      ],
    })),

  appendStreamLine: (line) => {
    const { appendLog } = get()
    if (line === '[DONE]') {
      appendLog('✓ Completed', 'success')
      return 'done'
    }
    if (line.startsWith('[ERROR]')) {
      const detail = line.replace('[ERROR]', '').trim()
      appendLog(`✗ Failed${detail ? `: ${detail}` : ''}`, 'error')
      return 'error'
    }
    appendLog(line)
    return 'line'
  },

  stopStream: () => {
    get().streamAbortController?.abort()
    set({ streamAbortController: null })
  },

  beginRemoteTerminal: (msg) => {
    const { clearLog, appendLog } = get()
    clearLog()
    const op = msg.operation
    set({
      terminalOperation: op,
      compileStatus: op === 'compile' ? 'running' : get().compileStatus,
      testStatus: op === 'test' ? 'running' : get().testStatus,
      deployStatus: op === 'deploy' ? 'running' : get().deployStatus,
      auditStatus: op === 'audit' ? 'running' : get().auditStatus,
      auditPanelOpen: op === 'audit' ? false : get().auditPanelOpen,
      auditShowTerminal: op === 'audit' ? true : get().auditShowTerminal,
      auditFindings: op === 'audit' ? [] : get().auditFindings,
    })
    appendLog(`[${msg.user_name}] ${op} started…`, 'info')
  },

  finishRemoteTerminal: (msg) => {
    const { appendLog } = get()
    const op = msg.operation
    const status = msg.success ? 'success' : 'error'
    set({
      terminalOperation: null,
      compileStatus: op === 'compile' ? status : get().compileStatus,
      testStatus: op === 'test' ? status : get().testStatus,
      deployStatus: op === 'deploy' ? status : get().deployStatus,
    })
    if (op === 'audit' && !msg.success && msg.message) {
      appendLog(`✗ ${msg.user_name}: ${msg.message}`, 'error')
    } else if (op !== 'audit' && !msg.success && msg.message) {
      appendLog(`✗ ${msg.user_name}: ${msg.message}`, 'error')
    }
  },

  clearLog: () => set({ outputLog: [] }),

  setWalletState: (wallet) => set({ wallet: { ...get().wallet, ...wallet } }),

  // ── Wallet (all browser-side, secret key never leaves the tab) ──────────
  generateWallet: () => {
    const kp = Keypair.random()
    set({
      generatedWallet: { publicKey: kp.publicKey(), secretKey: kp.secret() },
      walletBalance: '0',
      walletFunded: false,
    })
  },

  fundWallet: async (address) => {
    try {
      const r = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`)
      return r.ok
    } catch { return false }
  },

  checkBalance: async (address) => {
    try {
      const r = await fetch(`https://horizon-testnet.stellar.org/accounts/${address}`)
      if (!r.ok) return '0'
      const d = await r.json()
      return d.balances?.find(b => b.asset_type === 'native')?.balance ?? '0'
    } catch { return '0' }
  },

  setWalletBalance: (balance) =>
    set({ walletBalance: balance, walletFunded: parseFloat(balance) > 0 }),

  // ── IDE actions ──────────────────────────────────────────────────────────
  runCompile: async (projectId) => {
    const { clearLog, appendLog, loadFiles, stopStream, appendStreamLine } = get()
    stopStream()
    const controller = new AbortController()
    set({
      compileStatus: 'running',
      terminalOperation: 'compile',
      streamAbortController: controller,
    })
    clearLog()
    appendLog('$ cargo build --target wasm32-unknown-unknown --release', 'info')

    let wasmSaved = false
    try {
      await streamSsePost(`/projects/${projectId}/compile/stream`, {
        signal: controller.signal,
        onLine: (line) => {
          if (line.includes('WASM saved')) wasmSaved = true
          const result = appendStreamLine(line)
          if (result === 'done') {
            set({ compileStatus: 'success', terminalOperation: null })
          } else if (result === 'error') {
            set({ compileStatus: 'error', terminalOperation: null })
          }
        },
      })
      if (get().compileStatus === 'running') {
        set({ compileStatus: 'success', terminalOperation: null })
      }
      if (wasmSaved) await loadFiles(projectId)
    } catch (err) {
      if (err.name === 'AbortError') return
      set({ compileStatus: 'error', terminalOperation: null })
      appendLog('Connection lost: output may be incomplete', 'warning')
      if (err.message) appendLog(`✖  ${err.message}`, 'error')
    } finally {
      set({ streamAbortController: null, terminalOperation: null })
    }
  },

  runTest: async (projectId) => {
    const { clearLog, appendLog, stopStream, appendStreamLine } = get()
    stopStream()
    const controller = new AbortController()
    set({
      testStatus: 'running',
      terminalOperation: 'test',
      streamAbortController: controller,
    })
    clearLog()
    appendLog('$ cargo test', 'info')

    try {
      await streamSsePost(`/projects/${projectId}/test/stream`, {
        signal: controller.signal,
        onLine: (line) => {
          const result = appendStreamLine(line)
          if (result === 'done') {
            set({ testStatus: 'success', terminalOperation: null })
          } else if (result === 'error') {
            set({ testStatus: 'error', terminalOperation: null })
          }
        },
      })
      if (get().testStatus === 'running') {
        set({ testStatus: 'success', terminalOperation: null })
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      set({ testStatus: 'error', terminalOperation: null })
      appendLog('Connection lost: output may be incomplete', 'warning')
      if (err.message) appendLog(`✖  ${err.message}`, 'error')
    } finally {
      set({ streamAbortController: null, terminalOperation: null })
    }
  },

  runDeploy: async (projectId, options = {}) => {
    const {
      walletAddress,
      network = 'testnet',
      secretKey,
      useExternalWallet = false,
      files,
      signTransaction,
    } = options
    const { appendLog, clearLog } = get()

    if (useExternalWallet && signTransaction) {
      clearLog()
      set({ deployStatus: 'signing', terminalOperation: 'deploy' })
      appendLog('$ stellar contract deploy', 'info')
      appendLog(`   Network: ${network}`, 'info')
      appendLog(`   Wallet: ${walletAddress?.slice(0, 8)}...`, 'info')
      try {
        const wasmFile = (files || get().files).find(
          (f) => f.file_path?.endsWith('.wasm') || f.language === 'wasm'
        )
        if (!wasmFile?.content) {
          throw new Error('No WASM artifact found. Compile your contract first')
        }

        const wasmBytes = Uint8Array.from(atob(wasmFile.content), (c) => c.charCodeAt(0))
        appendLog('   Waiting for wallet signature…', 'info')

        const { contractId } = await deployContractWithWallet({
          wasmBytes,
          publicKey: walletAddress,
          network,
          signTransaction,
          onStatus: (msg) => appendLog(`   ${msg}`, 'info'),
        })

        set({ deployStatus: 'success' })
        appendLog('✔  Contract deployed via wallet', 'success')
        appendLog(`   Contract ID: ${contractId}`, 'success')
        return { success: true, contractId, usedWallet: true }
      } catch (err) {
        const msg = err?.message || 'Deploy failed'
        set({ deployStatus: 'error' })
        appendLog(`✖  ${msg}`, 'error')
        return {
          success: false,
          error: msg,
          rejected: msg.toLowerCase().includes('rejected'),
        }
      } finally {
        set({ terminalOperation: null })
      }
    }

    return get().runDeployStream(projectId, {
      walletAddress,
      network,
      secretKey,
    })
  },

  runDeployStream: async (projectId, { walletAddress, network, secretKey } = {}) => {
    const { clearLog, appendLog, stopStream, appendStreamLine } = get()
    stopStream()
    const controller = new AbortController()
    set({
      deployStatus: 'running',
      terminalOperation: 'deploy',
      streamAbortController: controller,
    })
    clearLog()
    appendLog('$ stellar contract deploy', 'info')
    appendLog(`   Network: ${network}`, 'info')
    appendLog(`   Wallet: ${walletAddress?.slice(0, 8)}...`, 'info')

    let contractId = null
    try {
      await streamSsePost(`/projects/${projectId}/deploy/stream`, {
        signal: controller.signal,
        body: {
          wallet_address: walletAddress,
          network,
          secret_key: secretKey,
        },
        onLine: (line) => {
          if (line.startsWith('   Contract ID:')) {
            contractId = line.replace('   Contract ID:', '').trim()
          }
          const result = appendStreamLine(line)
          if (result === 'done') {
            set({ deployStatus: 'success', terminalOperation: null })
          } else if (result === 'error') {
            set({ deployStatus: 'error', terminalOperation: null })
          }
        },
      })
      if (get().deployStatus === 'running') {
        set({ deployStatus: 'success', terminalOperation: null })
      }
      return { success: get().deployStatus === 'success', contractId }
    } catch (err) {
      if (err.name === 'AbortError') return { success: false }
      set({ deployStatus: 'error', terminalOperation: null })
      appendLog('Connection lost: output may be incomplete', 'warning')
      if (err.message) appendLog(`✖  ${err.message}`, 'error')
      return { success: false, error: err.message }
    } finally {
      set({ streamAbortController: null, terminalOperation: null })
    }
  },

  clearVerifyResult: () => set({ verifyStatus: 'idle', verifyResult: null, verifyError: null }),

  verifyContract: async (projectId, contractId, network = 'testnet') => {
    if (!projectId || !contractId?.trim()) {
      return { success: false, error: 'Contract ID is required' }
    }
    set({ verifyStatus: 'running', verifyResult: null, verifyError: null })
    try {
      const { data } = await api.post(`/projects/${projectId}/verify`, {
        contract_id: contractId.trim(),
        network,
      })
      set({ verifyStatus: 'success', verifyResult: data })
      return { success: true, result: data }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Verification failed'
      set({ verifyStatus: 'error', verifyError: msg })
      return { success: false, error: msg }
    }
  },

  saveFileContent: async (projectId, filePath, content) => {
    if (!projectId || !filePath) return { success: false }
    const language = filePath.endsWith('.toml') ? 'toml' : 'rust'
    try {
      await api.post(`/projects/${projectId}/files`, {
        file_path: filePath,
        content,
        language,
      })
      set((state) => ({
        files: state.files.map((f) =>
          f.file_path === filePath ? { ...f, content } : f
        ),
        activeFile: state.activeFile?.file_path === filePath
          ? { ...state.activeFile, content }
          : state.activeFile,
        editorContent: state.activeFile?.file_path === filePath ? content : state.editorContent,
      }))
      get().markTabClean(filePath)
      return { success: true }
    } catch {
      return { success: false }
    }
  },

  setAiExplainPanelOpen: (open) => set({ aiExplainPanelOpen: open }),
  setAiFixPanelOpen: (open) => set({ aiFixPanelOpen: open }),

  explainContract: async (projectId, network = 'testnet') => {
    if (!projectId) return
    const { appendLog } = get()
    set({
      aiStatus: 'running',
      aiExplainStatus: 'running',
      aiExplainError: null,
      aiExplainPanelOpen: true,
      aiFixPanelOpen: false,
      auditPanelOpen: false,
      aiExplainContent: '',
      aiExplainFile: get().activeFile?.file_path || 'src/lib.rs',
    })
    appendLog('Analyzing contract with AI...', 'info')
    try {
      const payload = buildAiContext(get(), network)
      const { data } = await api.post(`/projects/${projectId}/ai-explain`, payload)
      set({
        aiStatus: 'done',
        aiExplainStatus: 'done',
        aiExplainContent: data.markdown,
        aiExplainFile: data.file_path || payload.active_file,
      })
    } catch (err) {
      const msg = err.response?.data?.error || 'AI explanation failed. Check GROQ_API_KEY.'
      set({
        aiStatus: 'error',
        aiExplainStatus: 'error',
        aiExplainError: msg,
      })
      appendLog(`✖ ${msg}`, 'error')
    }
  },

  fixWithAI: async (projectId, network = 'testnet') => {
    if (!projectId) return
    const { outputLog, auditFindings, appendLog } = get()
    const hasErrors = outputLog.some((l) => l.level === 'error')
    const hasAudit = auditFindings?.length > 0
    if (!hasErrors && !hasAudit && get().compileStatus !== 'error') {
      appendLog('No errors or audit findings to fix. Compile or run audit first.', 'warning')
      return
    }
    set({
      aiStatus: 'running',
      aiFixStatus: 'running',
      aiFixError: null,
      aiFixPanelOpen: true,
      aiExplainPanelOpen: false,
      auditPanelOpen: false,
      aiFixProposal: null,
    })
    appendLog('Generating AI fix proposal...', 'info')
    try {
      const payload = buildAiContext(get(), network)
      const { data } = await api.post(`/projects/${projectId}/ai-fix`, payload)
      const fixes = (data.fixes || []).map((f) => ({ ...f, selected: true }))
      set({
        aiStatus: 'done',
        aiFixStatus: 'done',
        aiFixProposal: { ...data, fixes },
      })
    } catch (err) {
      const msg = err.response?.data?.error || 'AI fix failed. Check GROQ_API_KEY.'
      set({
        aiStatus: 'error',
        aiFixStatus: 'error',
        aiFixError: msg,
      })
      appendLog(`✖ ${msg}`, 'error')
    }
  },

  toggleAiFixSelection: (index, selected) => {
    const proposal = get().aiFixProposal
    if (!proposal?.fixes) return
    const fixes = proposal.fixes.map((f, i) => (i === index ? { ...f, selected } : f))
    set({ aiFixProposal: { ...proposal, fixes } })
  },

  rejectAiFix: () => {
    set({
      aiFixPanelOpen: false,
      aiFixProposal: null,
      aiFixStatus: 'idle',
      aiFixError: null,
      aiStatus: 'idle',
    })
  },

  applyAiFix: async (projectId) => {
    const { aiFixProposal, saveFileContent, setActiveFile } = get()
    if (!projectId || !aiFixProposal?.fixes?.length) return { success: false }
    const selected = aiFixProposal.fixes.filter((f) => f.selected !== false)
    if (!selected.length) return { success: false, reason: 'no_selection' }

    for (const fix of selected) {
      const result = await saveFileContent(projectId, fix.file_path, fix.fixed)
      if (!result.success) return { success: false, reason: 'save_failed' }
    }

    const activePath = get().activeFile?.file_path
    const focusFix = selected.find((f) => f.file_path === activePath) || selected[0]
    const file = get().files.find((f) => f.file_path === focusFix.file_path)
    if (file) get().openTab({ ...file, content: focusFix.fixed })

    set({
      aiFixPanelOpen: false,
      aiFixProposal: null,
      aiFixStatus: 'idle',
      aiStatus: 'idle',
    })
    return { success: true, count: selected.length }
  },

  // Backward-compatible alias
  explainError: async (projectId, network) => get().explainContract(projectId, network),

  runAudit: async (projectId) => {
    const { clearLog, appendLog, stopStream, appendStreamLine } = get()
    stopStream()
    const controller = new AbortController()
    set({
      auditStatus: 'running',
      terminalOperation: 'audit',
      streamAbortController: controller,
      auditFindings: [],
      auditRiskLevel: 'CLEAN',
      auditMessage: '',
      auditPanelOpen: false,
      auditShowTerminal: false,
    })
    clearLog()
    appendLog('$ cargo scout-audit --output-format json', 'info')

    const findings = []
    try {
      await streamSsePost(`/projects/${projectId}/audit/stream`, {
        signal: controller.signal,
        onLine: (line) => {
          if (line.startsWith('[FINDING] ')) {
            try {
              const finding = JSON.parse(line.slice(10))
              findings.push(finding)
              set({ auditFindings: [...findings] })
              appendLog(
                `   [${finding.severity}] ${finding.title} @ ${finding.file}:${finding.line_start}`,
                finding.severity === 'Critical' || finding.severity === 'High' ? 'error' : 'warning'
              )
            } catch {
              appendStreamLine(line)
            }
            return
          }
          const result = appendStreamLine(line)
          if (result === 'done') {
            set({
              auditStatus: findings.length === 0 ? 'success' : 'error',
              terminalOperation: null,
              auditPanelOpen: true,
              auditShowTerminal: false,
              auditRiskLevel: computeClientRiskLevel(findings),
              auditMessage: findings.length === 0 ? 'No vulnerabilities found' : `Found ${findings.length} issue(s)`,
            })
          } else if (result === 'error') {
            set({ auditStatus: 'error', terminalOperation: null, auditPanelOpen: true })
          }
        },
      })
      if (get().auditStatus === 'running') {
        set({
          auditStatus: findings.length === 0 ? 'success' : 'error',
          auditPanelOpen: true,
          auditRiskLevel: computeClientRiskLevel(findings),
          auditMessage: findings.length === 0 ? 'No vulnerabilities found' : `Found ${findings.length} issue(s)`,
        })
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      set({ auditStatus: 'error', terminalOperation: null, auditPanelOpen: true })
      appendLog('Connection lost: output may be incomplete', 'warning')
      if (err.message) appendLog(`✖  ${err.message}`, 'error')
    } finally {
      set({ streamAbortController: null, terminalOperation: null })
    }
  },

  applyRemoteAuditResults: (payload) => {
    const findings = payload.findings || []
    set({
      auditFindings: findings,
      auditRiskLevel: payload.risk_level || computeClientRiskLevel(findings),
      auditMessage: payload.message || '',
      auditStatus: payload.success && findings.length === 0 ? 'success' : findings.length ? 'error' : payload.success ? 'success' : 'error',
      auditPanelOpen: true,
      auditShowTerminal: false,
    })
  },

  setAuditPanelOpen: (auditPanelOpen) => set({ auditPanelOpen }),
  setAuditShowTerminal: (auditShowTerminal) => set({ auditShowTerminal }),

  jumpToFinding: (finding) => {
    const { files, openTab } = get()
    const target = files.find((f) => f.file_path === finding.file)
      || files.find((f) => f.file_path?.endsWith(finding.file?.split('/').pop()))
      || files.find((f) => f.file_path === 'src/lib.rs')
    if (target) openTab(target)
    set({
      editorHighlight: {
        file: finding.file,
        lineStart: finding.line_start || 1,
        lineEnd: finding.line_end || finding.line_start || 1,
      },
    })
  },

  openSearchMatch: (match) => {
    const { files, openTab } = get()
    const target = files.find((f) => f.file_path === match.file_path)
    if (target) openTab(target)
    set({
      editorHighlight: {
        file: match.file_path,
        lineStart: match.line_number,
        lineEnd: match.line_number,
        matchStart: match.match_start,
        matchEnd: match.match_end,
      },
    })
  },

  replaceInFiles: async (projectId, { query, replace, caseSensitive, wholeWord, useRegex, matches }) => {
    const { files, saveFileContent, openTab, activeTabId } = get()
    const byFile = {}
    matches.forEach((m) => {
      if (!byFile[m.file_path]) byFile[m.file_path] = []
      byFile[m.file_path].push(m)
    })

    for (const [filePath, fileMatches] of Object.entries(byFile)) {
      const file = files.find((f) => f.file_path === filePath)
      if (!file) continue
      let content = file.content
      const lines = content.split('\n')
      fileMatches
        .sort((a, b) => b.line_number - a.line_number || b.match_start - a.match_start)
        .forEach((m) => {
          const lineIdx = m.line_number - 1
          const line = lines[lineIdx]
          if (!line) return
          lines[lineIdx] = line.slice(0, m.match_start) + replace + line.slice(m.match_end)
        })
      content = lines.join('\n')
      await saveFileContent(projectId, filePath, content)
      if (activeTabId === filePath) {
        openTab({ ...file, content })
      }
    }
    return { success: true }
  },

  clearEditorHighlight: () => set({ editorHighlight: null }),

  applyFileTreeUpdate: (msg) => {
    const { files, activeFile, openTabs, activeTabId } = get()
    const { action, file_path, content, language, old_path } = msg

    if (action === 'create' || action === 'update') {
      const exists = files.some((f) => f.file_path === file_path)
      const entry = {
        id: `remote-${file_path}`,
        project_id: msg.project_id,
        file_path,
        content: content || '',
        language: language || 'rust',
      }
      set({
        files: exists
          ? files.map((f) => (f.file_path === file_path ? { ...f, ...entry } : f))
          : [...files, entry],
      })
    } else if (action === 'delete') {
      const remainingTabs = openTabs.filter((t) => t.fileId !== file_path)
      set({ files: files.filter((f) => f.file_path !== file_path) })
      if (!openTabs.some((t) => t.fileId === file_path)) return
      if (activeTabId === file_path) {
        const idx = openTabs.findIndex((t) => t.fileId === file_path)
        const next = remainingTabs[Math.max(0, idx - 1)] || remainingTabs[0]
        set({ openTabs: remainingTabs, activeTabId: next?.fileId || null })
        if (next) get().setActiveTab(next.fileId)
        else set({ activeFile: null, editorContent: '' })
      } else {
        set({ openTabs: remainingTabs })
      }
    } else if (action === 'rename' && old_path) {
      const renamedTabs = openTabs.map((t) =>
        t.fileId === old_path
          ? { ...t, fileId: file_path, path: file_path, filename: file_path.split('/').pop() }
          : t
      )
      set({
        files: files.map((f) =>
          f.file_path === old_path ? { ...f, file_path } : f
        ),
        openTabs: renamedTabs,
        activeTabId: activeTabId === old_path ? file_path : activeTabId,
        activeFile:
          activeFile?.file_path === old_path
            ? { ...activeFile, file_path }
            : activeFile,
      })
    }
  },

  debouncedSaveFile: async (projectId, filePath, content) => {
    if (!projectId || !filePath) return
    const language = filePath.endsWith('.toml') ? 'toml' : 'rust'
    try {
      await api.post(`/projects/${projectId}/files`, {
        file_path: filePath,
        content,
        language,
      })
    } catch {
      // silent — collab sync is primary
    }
  },
}))

export default useIdeStore
