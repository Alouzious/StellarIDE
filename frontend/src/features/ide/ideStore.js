import { create } from 'zustand'
import api from '../../services/api'
import { Keypair } from '@stellar/stellar-sdk'

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
      set({ isSaving: false })
      return { success: true }
    } catch {
      set({ isSaving: false })
      return { success: false }
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

  runDeploy: async (projectId, walletAddress, network, secretKey) => {
    const { appendLog } = get()
    set({ deployStatus: 'running' })
    appendLog('$ stellar contract deploy', 'info')
    appendLog(`   Network: ${network}`, 'info')
    appendLog(`   Wallet: ${walletAddress?.slice(0, 8)}...`, 'info')
    try {
      const { data } = await api.post(`/projects/${projectId}/deploy`, {
        wallet_address: walletAddress,
        network,
        secret_key: secretKey,
      })
      set({ deployStatus: data.success ? 'success' : 'error' })
      appendLog((data.success ? '✔  ' : '✖  ') + data.message, data.success ? 'success' : 'error')
      ;(data.logs || []).forEach(l => appendLog(l, 'info'))
      if (data.contract_id) appendLog(`   Contract ID: ${data.contract_id}`, 'success')
    } catch (err) {
      set({ deployStatus: 'error' })
      appendLog(`✖  ${err.response?.data?.error || 'Deploy failed.'}`, 'error')
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
}))

export default useIdeStore
