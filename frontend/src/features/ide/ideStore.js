import { create } from 'zustand'
import api from '../../services/api'
import { Keypair } from '@stellar/stellar-sdk'
import { deployContractWithWallet } from '../../lib/sorobanDeploy'

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

const useIdeStore = create((set, get) => ({
  project: null,
  files: [],
  activeFile: null,
  editorContent: DEFAULT_LIB_CONTENT,
  outputLog: [],
  compileStatus: 'idle',
  testStatus: 'idle',
  deployStatus: 'idle',
  auditStatus: 'idle',
  isSaving: false,

  // Generated wallet (keypair lives in browser only, never sent to DB)
  generatedWallet: null, // { publicKey, secretKey }
  walletBalance: '0',
  walletFunded: false,

  // Freighter wallet (future)
  wallet: { provider: 'freighter', connected: false, address: null, error: null },

  setProject: (project) => set({ project }),

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
        set({ activeFile, editorContent: activeFile.content })
      }
    } catch {
      // no files yet
    }
  },

  setActiveFile: (file) => set({ activeFile: file, editorContent: file.content }),

  setEditorContent: (content) =>
    set((state) => ({
      editorContent: content,
      activeFile: state.activeFile ? { ...state.activeFile, content } : state.activeFile,
    })),

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
    appendLog(`$ git push${branch ? ` origin ${branch}` : ''} — "${message}"`, 'info')
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

  appendLog: (line, level = 'info') =>
    set((state) => ({ outputLog: [...state.outputLog, { id: nextLogId(), line, level }] })),

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
    const { appendLog, loadFiles } = get()
    set({ compileStatus: 'running' })
    appendLog('$ cargo build --target wasm32-unknown-unknown --release', 'info')
    appendLog('   Starting compilation...', 'info')
    try {
      const { data } = await api.post(`/projects/${projectId}/compile`)
      set({ compileStatus: data.success ? 'success' : 'error' })
      appendLog((data.success ? '✔  ' : '✖  ') + data.message, data.success ? 'success' : 'error')
      ;(data.logs || []).forEach(l => appendLog(l, 'info'))
      if (data.wasm_artifact) appendLog(`   WASM: ${data.wasm_artifact}`, 'success')
      if (data.wasm_saved) {
        appendLog('   WASM saved — ready to deploy without recompiling ✓', 'success')
        await loadFiles(projectId)
      }
    } catch (err) {
      set({ compileStatus: 'error' })
      appendLog(`✖  ${err.response?.data?.error || 'Compilation failed.'}`, 'error')
      ;(err.response?.data?.logs || []).forEach(l => appendLog(l, 'info'))
    }
  },

  runTest: async (projectId) => {
    const { appendLog } = get()
    set({ testStatus: 'running' })
    appendLog('$ cargo test', 'info')
    appendLog('   Running tests...', 'info')
    try {
      const { data } = await api.post(`/projects/${projectId}/test`)
      set({ testStatus: data.success ? 'success' : 'error' })
      appendLog((data.success ? '✔  ' : '✖  ') + data.message, data.success ? 'success' : 'error')
      ;(data.logs || []).forEach(l => appendLog(l, 'info'))
    } catch (err) {
      set({ testStatus: 'error' })
      appendLog(`✖  ${err.response?.data?.error || 'Tests failed.'}`, 'error')
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
    const { appendLog } = get()
    set({ deployStatus: useExternalWallet ? 'signing' : 'running' })
    appendLog('$ stellar contract deploy', 'info')
    appendLog(`   Network: ${network}`, 'info')
    appendLog(`   Wallet: ${walletAddress?.slice(0, 8)}...`, 'info')

    if (useExternalWallet && signTransaction) {
      try {
        const wasmFile = (files || get().files).find(
          (f) => f.file_path?.endsWith('.wasm') || f.language === 'wasm'
        )
        if (!wasmFile?.content) {
          throw new Error('No WASM artifact found — compile your contract first')
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
      }
    }

    try {
      const { data } = await api.post(`/projects/${projectId}/deploy`, {
        wallet_address: walletAddress,
        network,
        secret_key: secretKey,
      })
      set({ deployStatus: data.success ? 'success' : 'error' })
      appendLog((data.success ? '✔  ' : '✖  ') + data.message, data.success ? 'success' : 'error')
      ;(data.logs || []).forEach((l) => appendLog(l, 'info'))
      if (data.contract_id) appendLog(`   Contract ID: ${data.contract_id}`, 'success')
      return { success: data.success, contractId: data.contract_id }
    } catch (err) {
      set({ deployStatus: 'error' })
      appendLog(`✖  ${err.response?.data?.error || 'Deploy failed.'}`, 'error')
      return { success: false, error: err.response?.data?.error || 'Deploy failed.' }
    }
  },

  aiStatus: 'idle', // 'idle' | 'running' | 'done' | 'error'

  fixWithAI: async (projectId) => {
    const { editorContent, outputLog, appendLog } = get()
    const errors = outputLog.filter(l => l.level === 'error').map(l => l.line).join('\n')
    if (!errors || !projectId) return
    set({ aiStatus: 'running' })
    appendLog('   Asking AI to fix the error...', 'info')
    try {
      const { data } = await api.post(`/projects/${projectId}/ai-fix`, {
        code: editorContent,
        errors,
      })
      if (data.result) {
        set({ aiStatus: 'done' })
        get().setEditorContent(data.result)
        appendLog('✔  AI applied fix — review the changes then compile again', 'success')
      } else {
        set({ aiStatus: 'error' })
        appendLog('✖  AI could not generate a fix', 'error')
      }
    } catch {
      set({ aiStatus: 'error' })
      appendLog('✖  AI fix failed — is GROQ_API_KEY set in backend .env?', 'error')
    }
  },

  explainError: async (projectId) => {
    const { editorContent, outputLog, appendLog } = get()
    const errors = outputLog.filter(l => l.level === 'error').map(l => l.line).join('\n')
    if (!errors || !projectId) return
    set({ aiStatus: 'running' })
    appendLog('   Asking AI to explain the error...', 'info')
    try {
      const { data } = await api.post(`/projects/${projectId}/ai-explain`, {
        code: editorContent,
        errors,
      })
      if (data.result) {
        set({ aiStatus: 'done' })
        data.result.split('\n').forEach(line => line.trim() && appendLog('   ' + line, 'warning'))
      } else {
        set({ aiStatus: 'error' })
        appendLog('✖  AI could not explain the error', 'error')
      }
    } catch {
      set({ aiStatus: 'error' })
      appendLog('✖  AI explain failed — is GROQ_API_KEY set in backend .env?', 'error')
    }
  },

  runAudit: async (projectId) => {
    const { appendLog } = get()
    set({ auditStatus: 'running' })
    appendLog('$ soroban audit', 'info')
    appendLog('   Running audit checks...', 'info')
    try {
      const { data } = await api.post(`/projects/${projectId}/audit`)
      set({ auditStatus: data.success ? 'success' : 'error' })
      const level = data.status === 'scaffold' ? 'warning' : data.success ? 'success' : 'error'
      appendLog((data.success ? '✔  ' : data.status === 'scaffold' ? '⚠  ' : '✖  ') + data.message, level)
      ;(data.logs || []).forEach(l => appendLog(l, 'info'))
    } catch (err) {
      set({ auditStatus: 'error' })
      appendLog(`✖  ${err.response?.data?.error || 'Audit failed.'}`, 'error')
    }
  },

  applyFileTreeUpdate: (msg) => {
    const { files, activeFile } = get()
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
      set({ files: files.filter((f) => f.file_path !== file_path) })
      if (activeFile?.file_path === file_path) {
        set({ activeFile: null, editorContent: '' })
      }
    } else if (action === 'rename' && old_path) {
      set({
        files: files.map((f) =>
          f.file_path === old_path ? { ...f, file_path } : f
        ),
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
