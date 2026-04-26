import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import {
  Code2, Play, TestTube, Rocket, Save, ChevronRight,
  ChevronDown, FileCode, FolderOpen, Terminal, X,
  Wallet, Users, ArrowLeft, Loader2, CheckCircle, XCircle,
  MessageSquare, BookOpen, ExternalLink, LogOut, Shield,
  Copy, Eye, EyeOff, RefreshCw, Package, Lock, Sparkles, HelpCircle,
  Globe, Zap, MessageCircle, FlaskConical, Search, Server,
} from 'lucide-react'
import useIdeStore from '../features/ide/ideStore'
import useChatStore from '../features/ide/chatStore'
import useDashboardStore from '../features/dashboard/dashboardStore'
import useAuthStore from '../features/auth/authStore'
import Button from '../components/ui/Button'
import ChatPanel from '../components/ui/ChatPanel'
import { ToastContainer } from '../components/ui/Toast'
import useToast from '../hooks/useToast'

const DEV_RESOURCES = [
  { label: 'Stellar.org', href: 'https://stellar.org', icon: 'Globe', category: 'Official' },
  { label: 'Developer Docs', href: 'https://developers.stellar.org', icon: 'BookOpen', category: 'Official' },
  { label: 'Soroban Docs', href: 'https://developers.stellar.org/docs/build/smart-contracts', icon: 'Zap', category: 'Official' },
  { label: 'Stellar CLI Docs', href: 'https://developers.stellar.org/docs/tools/stellar-cli', icon: 'Terminal2', category: 'Official' },
  { label: 'Stellar Discord', href: 'https://discord.gg/stellardev', icon: 'MessageCircle', category: 'Community' },
  { label: 'Stellar Stack Exchange', href: 'https://stellar.stackexchange.com', icon: 'HelpCircle', category: 'Community' },
  { label: 'Stellar Lab', href: 'https://lab.stellar.org', icon: 'FlaskConical', category: 'Tools' },
  { label: 'Stellar Expert Explorer', href: 'https://stellar.expert/explorer/public', icon: 'Search', category: 'Tools' },
  { label: 'Horizon API', href: 'https://developers.stellar.org/api/horizon', icon: 'Server', category: 'Tools' },
  { label: 'Soroban Examples', href: 'https://github.com/stellar/soroban-examples', icon: 'Github', category: 'Code' },
  { label: 'Stellar JS SDK', href: 'https://github.com/stellar/js-stellar-sdk', icon: 'Code2', category: 'Code' },
  { label: 'Soroban SDK (Rust)', href: 'https://docs.rs/soroban-sdk', icon: 'Package', category: 'Code' },
]

const RESOURCE_ICONS = {
  Globe, BookOpen, Zap, MessageCircle, HelpCircle,
  FlaskConical, Search, Server, Code2, Package,
  Terminal2: Terminal, Github: Code2,
}

function ResourcesMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const categories = [...new Set(DEV_RESOURCES.map(r => r.category))]

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-stellar-surface border border-stellar-border hover:border-stellar-accent/50 text-stellar-muted hover:text-white rounded-md text-xs font-medium transition-all">
        <BookOpen className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">Resources</span>
      </button>
      {open && (
        <div className="absolute right-0 top-9 w-64 bg-stellar-surface border border-stellar-border rounded-xl shadow-2xl z-50 py-2 overflow-hidden">
          <p className="px-3 py-1.5 text-xs font-bold text-stellar-border uppercase tracking-widest">
            Stellar Ecosystem
          </p>
          {categories.map(cat => (
            <div key={cat}>
              <p className="px-3 pt-2 pb-1 text-xs font-semibold text-stellar-accent/70 uppercase tracking-wider">
                {cat}
              </p>
              {DEV_RESOURCES.filter(r => r.category === cat).map((r) => {
                const Icon = RESOURCE_ICONS[r.icon] || BookOpen
                return (
                  <a key={r.href} href={r.href} target="_blank" rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs text-stellar-muted hover:text-white hover:bg-stellar-card transition-colors group">
                    <div className="w-6 h-6 rounded-md bg-stellar-card border border-stellar-border group-hover:border-stellar-accent/30 flex items-center justify-center flex-shrink-0 transition-colors">
                      <Icon className="w-3 h-3 text-stellar-accent" />
                    </div>
                    <span className="flex-1 font-medium">{r.label}</span>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                  </a>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FileTree({ files, activeFile, onSelect }) {
  const [expanded, setExpanded] = useState(true)
  const displayFiles = files.length > 0 ? files : [{ file_path: 'src/lib.rs', content: '' }]

  const getFileIcon = (filePath) => {
    if (filePath.endsWith('.toml')) return '⚙'
    if (filePath.endsWith('.wasm')) return '📦'
    return null
  }

  return (
    <div className="h-full overflow-auto p-2">
      <div className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer text-stellar-muted hover:text-stellar-text rounded group"
        onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <FolderOpen className="w-3.5 h-3.5 text-stellar-accent" />
        <span className="text-xs font-semibold">src</span>
      </div>
      {expanded && (
        <div className="ml-4">
          {displayFiles.map((f, idx) => (
            <div key={f.id || `${f.file_path}-${idx}`} onClick={() => onSelect(f)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs font-mono transition-colors ${
                activeFile?.file_path === f.file_path
                  ? 'bg-stellar-accent/15 text-stellar-accent border border-stellar-accent/20'
                  : 'text-stellar-muted hover:text-stellar-text hover:bg-stellar-surface'
              }`}>
              {getFileIcon(f.file_path)
                ? <span className="text-xs flex-shrink-0">{getFileIcon(f.file_path)}</span>
                : <FileCode className="w-3.5 h-3.5 flex-shrink-0" />}
              <span className="truncate">{f.file_path.split('/').pop()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function OutputPanel({ logs, onClear, onFix, onExplain, hasErrors, aiRunning }) {
  const bottomRef = useRef(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])
  const colors = { info: 'text-stellar-text', success: 'text-green-400', error: 'text-red-400', warning: 'text-yellow-400' }
  return (
    <div className="h-full flex flex-col bg-stellar-bg">
      <div className="flex items-center justify-between px-4 py-2 border-b border-stellar-border bg-stellar-card flex-shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-stellar-muted" />
          <span className="text-xs font-semibold text-stellar-muted uppercase tracking-wide">Output</span>
          {hasErrors && (
            <div className="flex items-center gap-1.5 ml-2">
              <button onClick={onFix} disabled={aiRunning}
                className="flex items-center gap-1 px-2 py-0.5 bg-stellar-accent/15 hover:bg-stellar-accent/25 border border-stellar-accent/30 text-stellar-accent rounded text-xs font-medium transition-all disabled:opacity-50">
                {aiRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Fix with AI
              </button>
              <button onClick={onExplain} disabled={aiRunning}
                className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-400 rounded text-xs font-medium transition-all disabled:opacity-50">
                <HelpCircle className="w-3 h-3" />
                Explain
              </button>
            </div>
          )}
        </div>
        <button onClick={onClear} className="text-stellar-border hover:text-stellar-muted transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-6 space-y-0.5">
        {logs.length === 0
          ? <span className="text-stellar-border">Run a command to see output...</span>
          : logs.map((l) => <div key={l.id} className={colors[l.level] || 'text-stellar-text'}>{l.line}</div>)}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ── Step badge for deploy panel ──────────────────────────────────────────────
function StepBadge({ n, label, state }) {
  // state: 'done' | 'active' | 'locked'
  const base = 'flex flex-col items-center gap-1'
  const circle = {
    done: 'w-7 h-7 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center',
    active: 'w-7 h-7 rounded-full bg-stellar-accent/20 border border-stellar-accent flex items-center justify-center',
    locked: 'w-7 h-7 rounded-full bg-stellar-surface border border-stellar-border flex items-center justify-center opacity-40',
  }
  const textColor = { done: 'text-green-400', active: 'text-stellar-accent', locked: 'text-stellar-border' }
  return (
    <div className={base}>
      <div className={circle[state]}>
        {state === 'done'
          ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
          : state === 'locked'
          ? <Lock className="w-3 h-3 text-stellar-border" />
          : <span className="text-xs font-bold text-stellar-accent">{n}</span>}
      </div>
      <span className={`text-xs font-medium ${textColor[state]}`}>{label}</span>
    </div>
  )
}

// ── Main Deploy Panel ─────────────────────────────────────────────────────────
function DeployPanel({ onClose, projectId }) {
  const {
    files, generatedWallet, walletBalance, walletFunded,
    generateWallet, fundWallet, checkBalance, setWalletBalance,
    runDeploy, deployStatus, appendLog, clearLog,
  } = useIdeStore()

  const [showSecret, setShowSecret] = useState(false)
  const [network, setNetwork] = useState('testnet')
  const [funding, setFunding] = useState(false)
  const [checkingBal, setCheckingBal] = useState(false)

  const wasmFile = files.find(f => f.file_path.endsWith('.wasm'))
  const step1Done = !!generatedWallet
  const step2Done = walletFunded
  const step3Ready = step1Done && step2Done && !!wasmFile

  const copy = (text) => navigator.clipboard.writeText(text)

  const handleFund = async () => {
    if (!generatedWallet) return
    setFunding(true)
    const ok = await fundWallet(generatedWallet.publicKey)
    if (ok) {
      // Wait a moment then check balance
      await new Promise(r => setTimeout(r, 2000))
      const bal = await checkBalance(generatedWallet.publicKey)
      setWalletBalance(bal)
    }
    setFunding(false)
  }

  const handleCheckBalance = async () => {
    if (!generatedWallet) return
    setCheckingBal(true)
    const bal = await checkBalance(generatedWallet.publicKey)
    setWalletBalance(bal)
    setCheckingBal(false)
  }

  const handleDeploy = async () => {
    if (!step3Ready) return
    clearLog()
    await runDeploy(projectId, generatedWallet.publicKey, network, generatedWallet.secretKey)
  }

  const stepState = (n) => {
    if (n === 1) return step1Done ? 'done' : 'active'
    if (n === 2) return step2Done ? 'done' : step1Done ? 'active' : 'locked'
    return step3Ready ? 'active' : 'locked'
  }

  return (
    <div className="w-80 flex-shrink-0 border-l border-stellar-border bg-stellar-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stellar-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-stellar-accent" />
          <span className="text-sm font-semibold text-stellar-heading">Deploy Contract</span>
        </div>
        <button onClick={onClose} className="text-stellar-border hover:text-stellar-muted transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Steps */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-stellar-border flex-shrink-0">
        <StepBadge n={1} label="Generate" state={stepState(1)} />
        <ChevronRight className="w-3 h-3 text-stellar-border mb-4" />
        <StepBadge n={2} label="Fund" state={stepState(2)} />
        <ChevronRight className="w-3 h-3 text-stellar-border mb-4" />
        <StepBadge n={3} label="Deploy" state={stepState(3)} />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">

        {/* Wallet section */}
        {!generatedWallet ? (
          <div className="space-y-3">
            <button onClick={generateWallet}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-stellar-accent hover:bg-stellar-accent-hover text-white rounded-lg text-sm font-semibold transition-all">
              <Wallet className="w-4 h-4" />
              Generate Wallet
            </button>
            <p className="text-xs text-stellar-muted text-center leading-relaxed">
              Creates a fresh Stellar keypair in your browser.<br />
              The secret key never leaves this tab.
            </p>
          </div>
        ) : (
          <div className="bg-stellar-surface border border-stellar-border rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stellar-heading flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                Wallet Ready
              </span>
              <button onClick={generateWallet}
                className="text-xs text-stellar-border hover:text-stellar-muted transition-colors">
                regenerate
              </button>
            </div>

            {/* Public key */}
            <div className="space-y-1">
              <span className="text-xs text-stellar-border uppercase tracking-wider">Public Key</span>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-xs font-mono text-stellar-text truncate">
                  {generatedWallet.publicKey.slice(0, 8)}...{generatedWallet.publicKey.slice(-6)}
                </span>
                <button onClick={() => copy(generatedWallet.publicKey)}
                  className="p-1 text-stellar-border hover:text-stellar-accent transition-colors flex-shrink-0"
                  title="Copy public key">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Secret key */}
            <div className="space-y-1">
              <span className="text-xs text-stellar-border uppercase tracking-wider">Secret Key</span>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-xs font-mono text-stellar-text truncate">
                  {showSecret
                    ? `${generatedWallet.secretKey.slice(0, 8)}...${generatedWallet.secretKey.slice(-6)}`
                    : '••••••••••••••••••••'}
                </span>
                <button onClick={() => setShowSecret(!showSecret)}
                  className="p-1 text-stellar-border hover:text-stellar-accent transition-colors flex-shrink-0"
                  title={showSecret ? 'Hide' : 'Reveal'}>
                  {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
                <button onClick={() => copy(generatedWallet.secretKey)}
                  className="p-1 text-stellar-border hover:text-stellar-accent transition-colors flex-shrink-0"
                  title="Copy secret key">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>

            <p className="text-xs text-yellow-500/80 bg-yellow-500/5 border border-yellow-500/20 rounded px-2 py-1.5 leading-relaxed">
              ⚠ Save your secret key before closing this tab.
            </p>

            {/* Balance + fund */}
            <div className="pt-1 border-t border-stellar-border/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-stellar-border">Balance</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono font-semibold ${walletFunded ? 'text-green-400' : 'text-stellar-muted'}`}>
                    {parseFloat(walletBalance).toFixed(2)} XLM
                  </span>
                  <button onClick={handleCheckBalance} disabled={checkingBal}
                    className="p-0.5 text-stellar-border hover:text-stellar-accent transition-colors disabled:opacity-50">
                    <RefreshCw className={`w-3 h-3 ${checkingBal ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
              {!walletFunded && (
                <button onClick={handleFund} disabled={funding}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-xs font-semibold transition-all disabled:opacity-50">
                  {funding
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Funding...</>
                    : <>⚡ Fund via Friendbot — Free</>}
                </button>
              )}
              {walletFunded && (
                <div className="flex items-center gap-1.5 text-xs text-green-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Funded and ready to deploy
                </div>
              )}
            </div>
          </div>
        )}

        {/* Freighter coming soon */}
        <div className="flex items-center gap-3 px-3 py-2.5 bg-stellar-surface/40 border border-stellar-border/50 rounded-lg opacity-50 cursor-not-allowed">
          <span className="text-base">🔷</span>
          <div className="flex-1 min-w-0">
            <span className="text-xs text-stellar-muted font-medium">Connect Wallet</span>
          </div>
          <span className="text-xs text-stellar-border bg-stellar-surface px-2 py-0.5 rounded-full flex-shrink-0">
            Soon
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-stellar-border/50" />

        {/* WASM status */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-stellar-border bg-stellar-surface">
          <Package className={`w-4 h-4 flex-shrink-0 ${wasmFile ? 'text-green-400' : 'text-stellar-border'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-stellar-text">WASM Artifact</p>
            <p className={`text-xs ${wasmFile ? 'text-green-400' : 'text-stellar-border'}`}>
              {wasmFile ? 'Compiled and ready' : 'Compile your contract first'}
            </p>
          </div>
          {wasmFile && <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />}
        </div>

        {/* Network selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-stellar-muted flex-shrink-0">Network</span>
          <select value={network} onChange={e => setNetwork(e.target.value)}
            className="flex-1 bg-stellar-surface border border-stellar-border text-stellar-text text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-stellar-accent/50">
            <option value="testnet">Testnet</option>
            <option value="mainnet">Mainnet</option>
          </select>
        </div>

        {/* Deploy button */}
        <button
          onClick={handleDeploy}
          disabled={!step3Ready || deployStatus === 'running'}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
            step3Ready
              ? 'bg-stellar-accent hover:bg-stellar-accent-hover text-white'
              : 'bg-stellar-surface border border-stellar-border text-stellar-border cursor-not-allowed opacity-50'
          }`}>
          {deployStatus === 'running'
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Deploying...</>
            : step3Ready
            ? <><Rocket className="w-4 h-4" /> Deploy to {network}</>
            : <><Lock className="w-4 h-4" /> Complete steps above</>}
        </button>

        {!step3Ready && (
          <div className="text-xs text-stellar-border space-y-1 px-1">
            {!step1Done && <p>① Generate a wallet above</p>}
            {step1Done && !step2Done && <p>② Fund your wallet via Friendbot</p>}
            {!wasmFile && <p>③ Compile your contract first</p>}
          </div>
        )}
      </div>
    </div>
  )
}

export default function IdePage() {
  const { id: projectId } = useParams()
  const navigate = useNavigate()
  const { projects, fetchProjects } = useDashboardStore()
  const { logout } = useAuthStore()
  const {
    project, files, activeFile, editorContent, outputLog,
    compileStatus, testStatus, deployStatus, auditStatus, isSaving, wallet, aiStatus,
    setProject, loadFiles, setActiveFile, setEditorContent, saveFile,
    runCompile, runTest, runAudit, clearLog, setWalletState, fixWithAI, explainError,
  } = useIdeStore()
  const { isOpen: chatOpen, toggleChat, closeChat } = useChatStore()
  const { toasts, toast, removeToast } = useToast()

  const [bottomPanelOpen, setBottomPanelOpen] = useState(true)
  const [deployPanelOpen, setDeployPanelOpen] = useState(false)
  const [terminalHeight, setTerminalHeight] = useState(176)
  const [chatWidth, setChatWidth] = useState(320)
  const dragRef = useRef(null)

  const startDrag = (e) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = terminalHeight
    const onMove = (ev) => {
      const delta = startY - ev.clientY
      setTerminalHeight(Math.min(Math.max(startH + delta, 80), 480))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const startChatDrag = (e) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = chatWidth
    const onMove = (ev) => {
      const delta = startX - ev.clientX
      setChatWidth(Math.min(Math.max(startW + delta, 240), 600))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  useEffect(() => { fetchProjects() }, [fetchProjects])

  useEffect(() => {
    if (projects.length > 0) {
      const found = projects.find((p) => p.id === projectId)
      if (found) setProject(found)
    }
  }, [projects, projectId, setProject])

  useEffect(() => {
    if (projectId) loadFiles(projectId)
  }, [projectId, loadFiles])

  const handleSave = async () => {
    const r = await saveFile(projectId)
    if (r.success) toast.success('File saved')
    else toast.error('Save failed')
  }

  const handleCompile = async () => {
    clearLog()
    setBottomPanelOpen(true)
    await runCompile(projectId)
  }

  const handleTest = async () => {
    clearLog()
    setBottomPanelOpen(true)
    await runTest(projectId)
  }

  const handleAudit = async () => {
    clearLog()
    setBottomPanelOpen(true)
    await runAudit(projectId)
  }

  // Deploy button opens the panel
  const handleDeployToggle = () => {
    setDeployPanelOpen(!deployPanelOpen)
    if (chatOpen) closeChat()
  }

  const handleLogout = () => { logout(); navigate('/') }

  const actionIcon = (status, IdleIcon) => {
    if (status === 'running') return <Loader2 className="w-3.5 h-3.5 animate-spin" />
    if (status === 'success') return <CheckCircle className="w-3.5 h-3.5 text-green-400" />
    if (status === 'error') return <XCircle className="w-3.5 h-3.5 text-red-400" />
    return <IdleIcon className="w-3.5 h-3.5" />
  }

  // Detect editor language from active file
  const editorLanguage = (() => {
    const fp = activeFile?.file_path || 'src/lib.rs'
    if (fp.endsWith('.toml')) return 'ini'
    if (fp.endsWith('.wasm')) return 'plaintext'
    return 'rust'
  })()

  return (
    <div className="flex flex-col h-screen bg-stellar-bg overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 h-12 border-b border-stellar-border bg-stellar-card flex-shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/dashboard')} className="text-stellar-muted hover:text-white transition-colors flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Link to="/" className="flex items-center gap-1.5 flex-shrink-0">
            <img src="/logo.png" alt="StellarIDE" className="w-4 h-4 object-contain" />
            <span className="text-sm font-bold text-stellar-heading hidden sm:block">
              Stellar<span className="text-stellar-accent">IDE</span>
            </span>
          </Link>
          <div className="h-4 w-px bg-stellar-border hidden sm:block" />
          <span className="text-sm text-stellar-muted truncate hidden sm:block">{project?.name || 'Loading...'}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stellar-surface border border-stellar-border hover:border-stellar-accent/50 text-stellar-muted hover:text-white rounded-md text-xs font-medium transition-all">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Save</span>
          </button>
          <button onClick={handleCompile} disabled={compileStatus === 'running'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stellar-accent hover:bg-stellar-accent-hover text-white rounded-md text-xs font-semibold transition-all disabled:opacity-50">
            {actionIcon(compileStatus, Play)}
            <span className="hidden sm:inline">Compile</span>
          </button>
          <button onClick={handleTest} disabled={testStatus === 'running'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stellar-surface border border-stellar-border hover:border-stellar-accent/50 text-stellar-muted hover:text-white rounded-md text-xs font-medium transition-all disabled:opacity-50">
            {actionIcon(testStatus, TestTube)}
            <span className="hidden sm:inline">Test</span>
          </button>
          <button onClick={handleDeployToggle}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs font-medium transition-all ${
              deployPanelOpen
                ? 'bg-stellar-accent/15 border-stellar-accent/40 text-stellar-accent'
                : 'bg-stellar-surface border-stellar-border text-stellar-muted hover:text-white hover:border-stellar-accent/40'
            }`}>
            {actionIcon(deployStatus, Rocket)}
            <span className="hidden sm:inline">Deploy</span>
          </button>
          <button onClick={handleAudit} disabled={auditStatus === 'running'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stellar-surface border border-stellar-border hover:border-stellar-accent/50 text-stellar-muted hover:text-white rounded-md text-xs font-medium transition-all disabled:opacity-50">
            {actionIcon(auditStatus, Shield)}
            <span className="hidden sm:inline">Audit</span>
          </button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <ResourcesMenu />
          <button onClick={() => { toggleChat(); if (deployPanelOpen) setDeployPanelOpen(false) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs font-medium transition-all ${
              chatOpen
                ? 'bg-stellar-accent/15 border-stellar-accent/40 text-stellar-accent'
                : 'bg-stellar-surface border-stellar-border text-stellar-muted hover:text-white hover:border-stellar-accent/40'
            }`}>
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">AI Chat</span>
          </button>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-md">
            <Users className="w-3 h-3 text-purple-400" />
            <span className="text-xs text-purple-400 font-medium hidden md:inline">Collab</span>
            <span className="text-xs text-purple-400/70 hidden md:inline">· Soon</span>
          </div>
          <button onClick={handleLogout}
            className="p-1.5 text-stellar-muted hover:text-white hover:bg-stellar-surface rounded-md transition-colors" title="Sign out">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* File Sidebar */}
        <div className="w-52 border-r border-stellar-border bg-stellar-card flex-shrink-0 hidden md:flex flex-col">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-stellar-border">
            <FolderOpen className="w-3.5 h-3.5 text-stellar-accent" />
            <span className="text-xs font-semibold text-stellar-muted uppercase tracking-wide">Explorer</span>
          </div>
          <FileTree files={files} activeFile={activeFile} onSelect={setActiveFile} />
        </div>

        {/* Editor + Output */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center border-b border-stellar-border bg-stellar-card h-8 flex-shrink-0">
            {activeFile && (
              <div className="flex items-center gap-2 px-4 h-full border-r border-stellar-border bg-stellar-surface text-xs font-mono text-stellar-text">
                <FileCode className="w-3.5 h-3.5 text-stellar-accent" />
                <span>{(activeFile.file_path || 'src/lib.rs').split('/').pop()}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0">
            {activeFile?.language === 'wasm' || activeFile?.file_path?.endsWith('.wasm') ? (
              <div className="h-full flex items-center justify-center text-stellar-muted">
                <div className="text-center space-y-2">
                  <Package className="w-10 h-10 mx-auto text-stellar-border" />
                  <p className="text-sm">Binary WASM file</p>
                  <p className="text-xs text-stellar-border">Compiled and saved — ready to deploy</p>
                </div>
              </div>
            ) : (
              <Editor
                height="100%"
                language={editorLanguage}
                value={editorContent}
                onChange={(val) => setEditorContent(val || '')}
                theme="vs-dark"
                options={{
                  fontSize: 13,
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  fontLigatures: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  renderLineHighlight: 'line',
                  automaticLayout: true,
                  tabSize: 4,
                  insertSpaces: true,
                  padding: { top: 16, bottom: 16 },
                }}
              />
            )}
          </div>
          {bottomPanelOpen && (
            <div className="border-t border-stellar-border flex-shrink-0 relative" style={{ height: terminalHeight }}>
              {/* Drag handle at TOP of terminal */}
              <div
                onMouseDown={startDrag}
                className="absolute top-0 left-0 right-0 h-1.5 cursor-row-resize hover:bg-stellar-accent/40 transition-colors z-10"
              />
              <OutputPanel
                logs={outputLog}
                onClear={clearLog}
                onFix={() => fixWithAI(projectId)}
                onExplain={() => explainError(projectId)}
                hasErrors={outputLog.some(l => l.level === 'error')}
                aiRunning={aiStatus === 'running'}
              />
            </div>
          )}
          <div className="flex items-center border-t border-stellar-border bg-stellar-card flex-shrink-0 select-none">
            <div
              className="flex flex-1 items-center justify-center h-5 cursor-pointer hover:bg-stellar-surface transition-colors"
              onClick={() => setBottomPanelOpen(!bottomPanelOpen)}>
              <div className="flex items-center gap-2 text-stellar-border hover:text-stellar-muted transition-colors">
                <Terminal className="w-3 h-3" />
                <span className="text-xs">Terminal</span>
                {bottomPanelOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </div>
            </div>
          </div>
        </div>

        {/* Deploy Panel */}
        {deployPanelOpen && (
          <DeployPanel onClose={() => setDeployPanelOpen(false)} projectId={projectId} />
        )}

        {/* AI Chat Panel */}
        {chatOpen && !deployPanelOpen && (
          <div className="flex-shrink-0 border-l border-stellar-border relative" style={{ width: chatWidth }}>
            {/* Horizontal drag handle on left edge */}
            <div
              onMouseDown={startChatDrag}
              className="absolute top-0 left-0 bottom-0 w-1.5 cursor-col-resize hover:bg-stellar-accent/40 transition-colors z-10"
            />
            <ChatPanel onClose={closeChat} />
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
