import { useEffect, useRef, useState, useMemo } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import {
  Code2, Play, TestTube, Rocket, Save, ChevronRight,
  ChevronDown, FileCode, FolderOpen, Terminal, X,
  Wallet, Users, ArrowLeft, Loader2, CheckCircle, XCircle,
  MessageSquare, BookOpen, ExternalLink, LogOut, Shield,
  Copy, Eye, EyeOff, RefreshCw, Package, Lock, Sparkles, HelpCircle,
  Globe, Zap, MessageCircle, FlaskConical, Search, Server, Upload, Settings, Link2,
  AlertCircle,
} from 'lucide-react'
import GitHubIcon from '../components/icons/GitHubIcon'
import useIdeStore from '../features/ide/ideStore'
import useChatStore from '../features/ide/chatStore'
import useDashboardStore from '../features/dashboard/dashboardStore'
import useAuthStore from '../features/auth/authStore'
import useGitHubStore from '../features/github/githubStore'
import useCollabStore from '../features/collab/collabStore'
import useWalletStore from '../features/wallet/walletStore'
import { ProjectCollabProvider } from '../features/collab/collabProvider'
import { getWalletKit } from '../lib/walletKit'
import { getExplorerContractUrl, getStellarLabContractUrl } from '../lib/sorobanDeploy'
import Button from '../components/ui/Button'
import ChatPanel from '../components/ui/ChatPanel'
import NestedFileTree from '../components/NestedFileTree'
import CollabEditor from '../components/CollabEditor'
import AuditResultsPanel from '../components/AuditResultsPanel'
import AiFixPanel from '../components/AiFixPanel'
import PresenceBar from '../components/PresenceBar'
import LinkGitHubModal from '../components/LinkGitHubModal'
import PushModal from '../components/PushModal'
import api, { getWsBaseUrl } from '../services/api'
import { buildExplainChatMessage } from '../lib/aiContext'
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
  Terminal2: Terminal, Github: GitHubIcon,
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

function FileTree({ files, activeFile, onSelect, readOnly, onDelete, onRename }) {
  return (
    <NestedFileTree
      files={files}
      activeFile={activeFile}
      onSelect={onSelect}
      readOnly={readOnly}
      onDelete={onDelete}
      onRename={onRename}
    />
  )
}

function OutputPanel({
  logs, onClear, onFix, onExplain, hasFixContext, aiBusy, readOnly,
  compileStatus, testStatus, deployStatus, auditStatus,
  showAuditResultsLink, onShowAuditResults,
}) {
  const bottomRef = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)

  const isStreaming =
    compileStatus === 'running' ||
    testStatus === 'running' ||
    deployStatus === 'running' ||
    deployStatus === 'signing' ||
    auditStatus === 'running'

  const headerStatus = (() => {
    if (compileStatus === 'running') return 'Compiling…'
    if (testStatus === 'running') return 'Testing…'
    if (deployStatus === 'running' || deployStatus === 'signing') return 'Deploying…'
    if (auditStatus === 'running') return 'Auditing…'
    return 'Ready'
  })()

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  const colors = {
    info: 'text-stellar-text',
    success: 'text-green-400',
    error: 'text-red-400',
    warning: 'text-yellow-400',
    running: 'text-cyan-400',
  }

  return (
    <div className="h-full flex flex-col bg-stellar-bg">
      <div className="flex items-center justify-between px-4 py-2 border-b border-stellar-border bg-stellar-card flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="w-3.5 h-3.5 text-stellar-muted flex-shrink-0" />
          <span className="text-xs font-semibold text-stellar-muted uppercase tracking-wide truncate">
            Terminal · {headerStatus}
          </span>
          <div className="flex items-center gap-1.5 ml-1">
            {!readOnly && hasFixContext && (
              <button onClick={onFix} disabled={aiBusy}
                className="flex items-center gap-1 px-2 py-0.5 bg-stellar-accent/15 hover:bg-stellar-accent/25 border border-stellar-accent/30 text-stellar-accent rounded text-xs font-medium transition-all disabled:opacity-50">
                {aiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Fix with AI
              </button>
            )}
            <button onClick={onExplain} disabled={aiBusy}
              title="Explain in AI Chat"
              className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-400 rounded text-xs font-medium transition-all disabled:opacity-50">
              <HelpCircle className="w-3 h-3" />
              Explain
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {showAuditResultsLink && (
            <button
              type="button"
              onClick={onShowAuditResults}
              className="text-xs px-2 py-0.5 rounded border border-stellar-border text-stellar-accent hover:bg-stellar-accent/10 transition-colors inline-flex items-center gap-1"
            >
              <Shield className="w-3 h-3" />
              Audit Results
            </button>
          )}
          <button
            type="button"
            onClick={() => setAutoScroll((v) => !v)}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
              autoScroll
                ? 'border-stellar-accent/40 text-stellar-accent bg-stellar-accent/10'
                : 'border-stellar-border text-stellar-muted hover:text-white'
            }`}
            title={autoScroll ? 'Auto-scroll on' : 'Auto-scroll off'}
          >
            Auto-scroll
          </button>
          <button
            type="button"
            onClick={onClear}
            className="text-xs px-2 py-0.5 rounded border border-stellar-border text-stellar-muted hover:text-white transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-6 space-y-0.5">
        {logs.length === 0
          ? <span className="text-stellar-border">Run a command to see output...</span>
          : logs.map((l, i) => {
            const isLast = i === logs.length - 1
            const showSpinner = isStreaming && isLast && l.level !== 'success' && l.level !== 'error'
            return (
              <div key={l.id} className={colors[l.level] || colors.info}>
                <span className="text-stellar-border mr-2">[{l.timestamp || '--:--:--'}]</span>
                {showSpinner && <span className="text-cyan-400 mr-1">⟳</span>}
                {l.line}
              </div>
            )
          })}
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
function truncateAddress(addr) {
  if (!addr || addr.length < 10) return addr || ''
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

function NetworkToggle() {
  const { network, setNetwork } = useWalletStore()
  return (
    <div className="flex items-center rounded-md border border-stellar-border overflow-hidden text-xs font-medium">
      {[
        { id: 'testnet', label: 'Testnet' },
        { id: 'mainnet', label: 'Mainnet' },
      ].map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => setNetwork(id)}
          className={`px-2.5 py-1.5 transition-colors ${
            network === id
              ? 'bg-stellar-accent/20 text-stellar-accent'
              : 'bg-stellar-surface text-stellar-muted hover:text-white'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function DeployPanel({ onClose, projectId }) {
  const {
    files, generatedWallet, walletBalance, walletFunded,
    generateWallet, fundWallet, checkBalance, setWalletBalance,
    runDeploy, deployStatus, clearLog,
  } = useIdeStore()
  const {
    connectedAddress,
    connectedWalletId,
    network,
    walletBalance: connectedBalance,
    isConnecting,
    lastDeployContractId,
    connectWallet,
    disconnectWallet,
    fetchBalance,
    networkMatchesWallet,
    setLastDeployContractId,
    walletLabel,
  } = useWalletStore()
  const { toast } = useToast()

  const [showSecret, setShowSecret] = useState(false)
  const [funding, setFunding] = useState(false)
  const [fundingConnected, setFundingConnected] = useState(false)
  const [checkingBal, setCheckingBal] = useState(false)
  const [checkingConnectedBal, setCheckingConnectedBal] = useState(false)

  const wasmFile = files.find((f) => f.file_path?.endsWith('.wasm'))
  const step1Done = !!generatedWallet
  const step2Done = walletFunded
  const step3Ready = step1Done && step2Done && !!wasmFile
  const usingConnectedWallet = !!connectedAddress
  const walletName = walletLabel()
  const networkOk = networkMatchesWallet()
  const deployReady = !!wasmFile && (
    (usingConnectedWallet && networkOk) ||
    (!usingConnectedWallet && step3Ready)
  )
  const isDeploying = deployStatus === 'running' || deployStatus === 'signing'

  const copy = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const handleConnect = async () => {
    const result = await connectWallet()
    if (result.cancelled) return
    if (!result.success) toast.error(result.error || 'Failed to connect wallet')
    else toast.success(`Connected via ${walletLabel()}`)
  }

  const handleDisconnect = async () => {
    await disconnectWallet()
    toast.success('Wallet disconnected')
  }

  const handleFund = async () => {
    if (!generatedWallet) return
    setFunding(true)
    const ok = await fundWallet(generatedWallet.publicKey)
    if (ok) {
      await new Promise((r) => setTimeout(r, 2000))
      const bal = await checkBalance(generatedWallet.publicKey)
      setWalletBalance(bal)
    }
    setFunding(false)
  }

  const handleFundConnected = async () => {
    if (!connectedAddress || network !== 'testnet') return
    setFundingConnected(true)
    const ok = await fundWallet(connectedAddress)
    if (ok) {
      await new Promise((r) => setTimeout(r, 2000))
      await fetchBalance(connectedAddress, network)
    }
    setFundingConnected(false)
  }

  const handleCheckBalance = async () => {
    if (!generatedWallet) return
    setCheckingBal(true)
    const bal = await checkBalance(generatedWallet.publicKey)
    setWalletBalance(bal)
    setCheckingBal(false)
  }

  const handleCheckConnectedBalance = async () => {
    if (!connectedAddress) return
    setCheckingConnectedBal(true)
    await fetchBalance(connectedAddress, network)
    setCheckingConnectedBal(false)
  }

  const handleDeploy = async () => {
    if (!deployReady || isDeploying) return
    clearLog()
    setLastDeployContractId(null)

    if (usingConnectedWallet) {
      const kit = getWalletKit()
      const result = await runDeploy(projectId, {
        walletAddress: connectedAddress,
        network,
        useExternalWallet: true,
        files,
        signTransaction: kit.signTransaction.bind(kit),
      })
      if (result.rejected) {
        toast.error('Transaction rejected in wallet')
      } else if (result.success && result.contractId) {
        setLastDeployContractId(result.contractId)
        toast.success('Contract deployed successfully')
      } else if (!result.success) {
        toast.error(result.error || 'Deploy failed')
      }
      return
    }

    const result = await runDeploy(projectId, {
      walletAddress: generatedWallet.publicKey,
      network,
      secretKey: generatedWallet.secretKey,
      useExternalWallet: false,
    })
    if (result?.contractId) setLastDeployContractId(result.contractId)
  }

  const stepState = (n) => {
    if (usingConnectedWallet) return 'done'
    if (n === 1) return step1Done ? 'done' : 'active'
    if (n === 2) return step2Done ? 'done' : step1Done ? 'active' : 'locked'
    return step3Ready ? 'active' : 'locked'
  }

  const connectedBalNum = parseFloat(connectedBalance || '0')
  const networkBadgeClass = network === 'mainnet'
    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    : 'bg-blue-500/15 text-blue-300 border-blue-500/30'

  return (
    <div className="w-80 flex-shrink-0 border-l border-stellar-border bg-stellar-card flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stellar-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-stellar-accent" />
          <span className="text-sm font-semibold text-stellar-heading">Deploy Contract</span>
        </div>
        <button onClick={onClose} className="text-stellar-border hover:text-stellar-muted transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-b border-stellar-border flex-shrink-0">
        <StepBadge n={1} label="Generate" state={stepState(1)} />
        <ChevronRight className="w-3 h-3 text-stellar-border mb-4" />
        <StepBadge n={2} label="Fund" state={stepState(2)} />
        <ChevronRight className="w-3 h-3 text-stellar-border mb-4" />
        <StepBadge n={3} label="Deploy" state={stepState(3)} />
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Connected wallet */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stellar-heading uppercase tracking-wider">Connect Wallet</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${networkBadgeClass}`}>
              {network === 'mainnet' ? 'Mainnet' : 'Testnet'}
            </span>
          </div>

          {!connectedAddress ? (
            <>
              <button
                type="button"
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-stellar-accent hover:bg-stellar-accent-hover text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              >
                {isConnecting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</>
                  : <><Wallet className="w-4 h-4" /> Connect Wallet</>}
              </button>
              <p className="text-xs text-stellar-muted text-center leading-relaxed">
                Sign with Freighter, Albedo, xBull, Ledger, and more.
              </p>
            </>
          ) : (
            <div className="bg-stellar-surface border border-stellar-accent/30 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-stellar-heading flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                  {walletName}
                </span>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="text-xs text-stellar-muted hover:text-red-400 transition-colors"
                >
                  Disconnect
                </button>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-stellar-border uppercase tracking-wider">Address</span>
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-xs font-mono text-stellar-text">
                    {truncateAddress(connectedAddress)}
                  </span>
                  <button
                    type="button"
                    onClick={() => copy(connectedAddress)}
                    className="p-1 text-stellar-border hover:text-stellar-accent transition-colors"
                    title="Copy address"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-stellar-border/50">
                <span className="text-xs text-stellar-border">Balance</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono font-semibold ${connectedBalNum > 0 ? 'text-green-400' : 'text-stellar-muted'}`}>
                    {connectedBalNum.toFixed(2)} XLM
                  </span>
                  <button
                    type="button"
                    onClick={handleCheckConnectedBalance}
                    disabled={checkingConnectedBal}
                    className="p-0.5 text-stellar-border hover:text-stellar-accent transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${checkingConnectedBal ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {network === 'testnet' && connectedBalNum === 0 && (
                <button
                  type="button"
                  onClick={handleFundConnected}
                  disabled={fundingConnected}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                >
                  {fundingConnected
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Funding…</>
                    : <>⚡ Fund via Friendbot Free</>}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stellar-border/50" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-stellar-card px-2 text-[10px] uppercase tracking-wider text-stellar-border">
              Generate a new wallet instead
            </span>
          </div>
        </div>

        {/* Generated wallet fallback */}
        {!generatedWallet ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={generateWallet}
              disabled={!!connectedAddress}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-stellar-surface border border-stellar-border hover:border-stellar-accent/40 text-stellar-muted hover:text-white rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
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
                Generated Wallet
              </span>
              <button
                type="button"
                onClick={generateWallet}
                disabled={!!connectedAddress}
                className="text-xs text-stellar-border hover:text-stellar-muted transition-colors disabled:opacity-40"
              >
                regenerate
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-stellar-border uppercase tracking-wider">Public Key</span>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-xs font-mono text-stellar-text truncate">
                  {truncateAddress(generatedWallet.publicKey)}
                </span>
                <button type="button" onClick={() => copy(generatedWallet.publicKey)}
                  className="p-1 text-stellar-border hover:text-stellar-accent transition-colors flex-shrink-0"
                  title="Copy public key">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-stellar-border uppercase tracking-wider">Secret Key</span>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-xs font-mono text-stellar-text truncate">
                  {showSecret
                    ? truncateAddress(generatedWallet.secretKey)
                    : '••••••••••••••••••••'}
                </span>
                <button type="button" onClick={() => setShowSecret(!showSecret)}
                  className="p-1 text-stellar-border hover:text-stellar-accent transition-colors flex-shrink-0"
                  title={showSecret ? 'Hide' : 'Reveal'}>
                  {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
                <button type="button" onClick={() => copy(generatedWallet.secretKey)}
                  className="p-1 text-stellar-border hover:text-stellar-accent transition-colors flex-shrink-0"
                  title="Copy secret key">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>

            <p className="text-xs text-yellow-500/80 bg-yellow-500/5 border border-yellow-500/20 rounded px-2 py-1.5 leading-relaxed">
              Save your secret key before closing this tab.
            </p>

            <div className="pt-1 border-t border-stellar-border/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-stellar-border">Balance</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono font-semibold ${walletFunded ? 'text-green-400' : 'text-stellar-muted'}`}>
                    {parseFloat(walletBalance).toFixed(2)} XLM
                  </span>
                  <button type="button" onClick={handleCheckBalance} disabled={checkingBal}
                    className="p-0.5 text-stellar-border hover:text-stellar-accent transition-colors disabled:opacity-50">
                    <RefreshCw className={`w-3 h-3 ${checkingBal ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
              {!walletFunded && !connectedAddress && (
                <button type="button" onClick={handleFund} disabled={funding}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-xs font-semibold transition-all disabled:opacity-50">
                  {funding
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Funding…</>
                    : <>Fund via Friendbot Free</>}
                </button>
              )}
              {walletFunded && !connectedAddress && (
                <div className="flex items-center gap-1.5 text-xs text-green-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Funded and ready to deploy
                </div>
              )}
            </div>
          </div>
        )}

        <div className="border-t border-stellar-border/50" />

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

        {connectedAddress && network === 'mainnet' && (
          <div className="flex gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200 leading-relaxed">
              You are deploying to <strong>Mainnet</strong>. This uses real XLM and cannot be undone. Double-check your contract before signing.
            </p>
          </div>
        )}

        {connectedAddress && !networkOk && (
          <div className="flex gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-200 leading-relaxed">
              IDE network ({network === 'mainnet' ? 'Mainnet' : 'Testnet'}) does not match your wallet. Switch the network toggle or reconnect your wallet.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={handleDeploy}
          disabled={!deployReady || isDeploying}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
            deployReady
              ? 'bg-stellar-accent hover:bg-stellar-accent-hover text-white'
              : 'bg-stellar-surface border border-stellar-border text-stellar-border cursor-not-allowed opacity-50'
          }`}
        >
          {deployStatus === 'signing'
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Waiting for wallet signature…</>
            : deployStatus === 'running'
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Deploying…</>
            : deployReady && usingConnectedWallet
            ? <><Wallet className="w-4 h-4" /> Deploy with {walletName}</>
            : deployReady
            ? <><Rocket className="w-4 h-4" /> Deploy with Generated Wallet</>
            : <><Lock className="w-4 h-4" /> Complete steps above</>}
        </button>

        {!deployReady && (
          <div className="text-xs text-stellar-border space-y-1 px-1">
            {!wasmFile && <p>Compile your contract first</p>}
            {wasmFile && !usingConnectedWallet && !step1Done && <p>Connect a wallet or generate one below</p>}
            {wasmFile && !usingConnectedWallet && step1Done && !step2Done && <p>Fund your generated wallet via Friendbot</p>}
            {wasmFile && usingConnectedWallet && !networkOk && <p>Fix network mismatch before deploying</p>}
          </div>
        )}

        {lastDeployContractId && deployStatus === 'success' && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-green-400">
              <CheckCircle className="w-3.5 h-3.5" />
              Contract deployed
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-stellar-border uppercase tracking-wider">Contract ID</span>
              <div className="flex items-start gap-2">
                <code className="flex-1 text-[11px] font-mono text-stellar-text break-all leading-relaxed">
                  {lastDeployContractId}
                </code>
                <button
                  type="button"
                  onClick={() => copy(lastDeployContractId)}
                  className="p-1 text-stellar-border hover:text-stellar-accent transition-colors flex-shrink-0"
                  title="Copy contract ID"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href={getExplorerContractUrl(lastDeployContractId, network)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-stellar-accent hover:underline"
              >
                Stellar Expert
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={getStellarLabContractUrl(lastDeployContractId, network)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-stellar-accent hover:underline"
              >
                Stellar Lab
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const COLLAB_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']

function userColor(userId) {
  if (!userId) return COLLAB_COLORS[0]
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash + userId.charCodeAt(i)) % COLLAB_COLORS.length
  return COLLAB_COLORS[hash]
}

function GitHubPushBar({ project, onOpenPush, readOnly }) {
  const { connectGitHub, fetchStatus, status } = useGitHubStore()

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  if (!project?.github_owner || !project?.github_repo) return null

  const repoLabel = `${project.github_owner}/${project.github_repo}`
  const needsReconnect = !status?.connected && !!status?.reason

  return (
    <div className="border-b border-stellar-border bg-stellar-card/80 flex-shrink-0">
      {needsReconnect && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span className="text-xs text-amber-300 flex-1">{status.reason}</span>
          <button
            type="button"
            onClick={connectGitHub}
            className="text-xs font-semibold text-amber-200 hover:underline"
          >
            Reconnect GitHub
          </button>
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-1.5 flex-wrap">
        <GitHubIcon className="w-3.5 h-3.5 text-stellar-muted flex-shrink-0" />
        <span className="text-xs text-stellar-muted truncate max-w-[140px]" title={repoLabel}>
          {repoLabel}
        </span>
        <span className="text-xs text-stellar-border">·</span>
        <span className="text-xs text-stellar-muted">{project.github_branch || 'main'}</span>
        {project.github_subfolder && (
          <>
            <span className="text-xs text-stellar-border">·</span>
            <span className="text-xs text-stellar-accent truncate max-w-[120px]" title={project.github_subfolder}>
              {project.github_subfolder}/
            </span>
          </>
        )}
        {!status?.connected && !needsReconnect && (
          <button
            type="button"
            onClick={connectGitHub}
            className="text-xs text-stellar-accent hover:underline ml-1"
          >
            Connect GitHub
          </button>
        )}
        <button
          type="button"
          onClick={onOpenPush}
          disabled={!status?.connected || readOnly}
          className="flex items-center gap-1 px-2.5 py-1 bg-stellar-accent hover:bg-stellar-accent-hover text-white rounded text-xs font-semibold transition-all disabled:opacity-50 ml-auto"
        >
          <Upload className="w-3 h-3" />
          Push
        </button>
      </div>
    </div>
  )
}

function GitHubLinkBar({ onLink, readOnly, isOwner }) {
  if (readOnly || !isOwner) return null
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-stellar-border bg-stellar-card/50 flex-shrink-0">
      <GitHubIcon className="w-3.5 h-3.5 text-stellar-muted flex-shrink-0" />
      <span className="text-xs text-stellar-muted">Push to GitHub link a repository</span>
      <button
        type="button"
        onClick={onLink}
        className="flex items-center gap-1 text-xs text-stellar-accent hover:underline ml-auto"
      >
        <Link2 className="w-3 h-3" />
        Link Repo
      </button>
    </div>
  )
}

export default function IdePage() {
  const { id: projectId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { projects, fetchProjects } = useDashboardStore()
  const { logout, user, token } = useAuthStore()
  const {
    role, presence,
    fetchRole, joinInvite, setPresence,
    setFileConnectionStatus, setProjectConnectionStatus,
    setDeployLock, reset: resetCollab, isReadOnly,
  } = useCollabStore()
  const {
    project, files, activeFile, editorContent, outputLog,
    compileStatus, testStatus, deployStatus, auditStatus, isSaving, wallet,
    setProject, loadFiles, setActiveFile, setEditorContent, saveFile,
    runCompile, runTest, runAudit, clearLog, setWalletState, fixWithAI,
    applyAiFix, rejectAiFix, toggleAiFixSelection,
    applyFileTreeUpdate, debouncedSaveFile, appendLog, appendStreamLine,
    beginRemoteTerminal, finishRemoteTerminal, applyRemoteAuditResults,
    auditFindings, auditRiskLevel, auditMessage, auditPanelOpen, auditShowTerminal,
    setAuditPanelOpen, setAuditShowTerminal, jumpToFinding, editorHighlight,
    aiFixPanelOpen, aiFixProposal, aiFixStatus, aiFixError,
    setAiFixPanelOpen,
  } = useIdeStore()
  const { network } = useWalletStore()
  const {
    isOpen: chatOpen, toggleChat, closeChat, openChat, sendMessage,
    isLoading: chatLoading, setProjectId: setChatProjectId,
  } = useChatStore()
  const { toasts, toast, removeToast } = useToast()

  const [bottomPanelOpen, setBottomPanelOpen] = useState(true)
  const [deployPanelOpen, setDeployPanelOpen] = useState(false)
  const [terminalHeight, setTerminalHeight] = useState(176)
  const [chatWidth, setChatWidth] = useState(320)
  const [pushModalOpen, setPushModalOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const projectCollabRef = useRef(null)
  const collabCallbacksRef = useRef({})
  const readOnly = isReadOnly()
  const fileConnectionStatus = useCollabStore((s) => s.fileConnectionStatus)
  const projectConnectionStatus = useCollabStore((s) => s.projectConnectionStatus)
  const deployLock = useCollabStore((s) => s.deployLock)
  const connectionStatus = useMemo(() => {
    const statuses = [fileConnectionStatus, projectConnectionStatus]
    if (statuses.some((s) => s === 'disconnected' || s === 'error')) return 'disconnected'
    if (statuses.some((s) => s === 'reconnecting' || s === 'connecting')) return 'reconnecting'
    if (statuses.every((s) => s === 'connected')) return 'connected'
    return 'idle'
  }, [fileConnectionStatus, projectConnectionStatus])
  const userName = user?.email?.split('@')[0] || 'user'
  const userColorHex = useMemo(() => userColor(user?.id || ''), [user?.id])

  useEffect(() => {
    if (projectId) fetchRole(projectId)
    setChatProjectId(projectId || null)
    return () => resetCollab()
  }, [projectId, fetchRole, resetCollab, setChatProjectId])

  useEffect(() => {
    const invite = searchParams.get('invite')
    if (!invite || !projectId) return
    joinInvite(projectId, invite).then((r) => {
      if (r.success) toast.success(`Joined as ${r.role}`)
      else toast.error(r.error || 'Invalid invite')
      searchParams.delete('invite')
      setSearchParams(searchParams, { replace: true })
    })
  }, [projectId, searchParams, joinInvite, setSearchParams, toast])

  const handleSessionRestored = (reason) => {
    if (reason === 'restored') {
      toast.info('Session restored from last saved state')
      if (projectId) loadFiles(projectId)
    } else if (reason === 'disconnected') {
      toast.error('Collaboration disconnected. Refresh if issues persist.')
    }
  }

  collabCallbacksRef.current = {
    applyFileTreeUpdate,
    toast,
    loadFiles,
    appendLog,
    appendStreamLine,
    beginRemoteTerminal,
    finishRemoteTerminal,
    setPresence,
    setDeployLock,
    handleSessionRestored,
    userId: user?.id,
    setBottomPanelOpen,
    applyRemoteAuditResults,
    setAuditPanelOpen,
    setAuditShowTerminal,
  }

  const sendFileTreeUpdate = (payload, optimistic = true) => {
    if (optimistic) {
      applyFileTreeUpdate({ ...payload, project_id: projectId })
    }
    projectCollabRef.current?.sendFileTreeUpdate(payload)
  }

  useEffect(() => {
    if (!projectId || !token || !user?.id) return

    const url = `${getWsBaseUrl()}/collab/${projectId}/project?token=${encodeURIComponent(token)}`
    projectCollabRef.current = new ProjectCollabProvider({
      url,
      userId: user.id,
      onFileTreeUpdate: (msg) => {
        collabCallbacksRef.current.applyFileTreeUpdate({ ...msg, project_id: projectId })
      },
      onFileTreeError: (msg) => {
        collabCallbacksRef.current.toast.error(msg.message || 'File tree sync failed')
        collabCallbacksRef.current.loadFiles(projectId)
      },
      onPresence: (users) => collabCallbacksRef.current.setPresence(users),
      onStatus: setProjectConnectionStatus,
      onCompileOutput: () => {},
      onTestOutput: () => {},
      onTerminalStarted: (msg) => {
        if (msg.user_id === collabCallbacksRef.current.userId) return
        collabCallbacksRef.current.setBottomPanelOpen(true)
        collabCallbacksRef.current.beginRemoteTerminal(msg)
      },
      onTerminalOutput: (msg) => {
        if (msg.user_id === collabCallbacksRef.current.userId) return
        collabCallbacksRef.current.appendStreamLine(msg.data)
      },
      onTerminalDone: (msg) => {
        if (msg.user_id === collabCallbacksRef.current.userId) return
        collabCallbacksRef.current.finishRemoteTerminal(msg)
      },
      onAuditStarted: (msg) => {
        if (msg.user_id === collabCallbacksRef.current.userId) return
        collabCallbacksRef.current.setBottomPanelOpen(true)
      },
      onAuditComplete: (msg) => {
        if (msg.user_id === collabCallbacksRef.current.userId) return
        collabCallbacksRef.current.applyRemoteAuditResults({
          findings: msg.findings,
          risk_level: msg.risk_level,
          message: msg.message,
          success: msg.success,
        })
      },
      onDeployStarted: (msg) => {
        collabCallbacksRef.current.setDeployLock({ user_id: msg.user_id, user_name: msg.user_name })
        if (msg.user_id !== collabCallbacksRef.current.userId) {
          collabCallbacksRef.current.appendLog(`${msg.user_name} is deploying…`, 'warning')
        }
      },
      onDeployFinished: () => collabCallbacksRef.current.setDeployLock(null),
      onSessionRestored: (reason) => collabCallbacksRef.current.handleSessionRestored(reason),
    })

    return () => {
      projectCollabRef.current?.destroy()
      projectCollabRef.current = null
    }
  }, [projectId, token, user?.id, setProjectConnectionStatus])

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
    if (projectId) {
      loadFiles(projectId)
      api.get(`/projects/${projectId}`).then(({ data }) => setProject(data)).catch(() => {})
    }
  }, [projectId, loadFiles, setProject])

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
    setAuditPanelOpen(false)
    setAuditShowTerminal(true)
    await runAudit(projectId)
  }

  const hasFixContext = useMemo(
    () =>
      outputLog.some((l) => l.level === 'error')
      || auditFindings.length > 0
      || compileStatus === 'error',
    [outputLog, auditFindings, compileStatus]
  )

  const aiBusy = aiFixStatus === 'running' || chatLoading

  const handleExplain = async () => {
    if (deployPanelOpen) setDeployPanelOpen(false)
    openChat()
    const message = buildExplainChatMessage({ activeFile, editorContent, outputLog })
    await sendMessage(message)
  }

  const handleFix = async () => {
    setBottomPanelOpen(true)
    setAiFixPanelOpen(true)
    await fixWithAI(projectId, network)
  }

  const handleApplyFix = async () => {
    const result = await applyAiFix(projectId)
    if (result.success) {
      toast.success('Fix applied. Recompiling...')
      setBottomPanelOpen(true)
      await runCompile(projectId)
    } else if (result.reason === 'no_selection') {
      toast.error('Select at least one fix to apply')
    } else {
      toast.error('Failed to apply fix')
    }
  }

  useEffect(() => {
    if (!projectId || readOnly) return
    const onKeyDown = (e) => {
      if (!e.ctrlKey || !e.shiftKey) return
      if (e.key === 'E' || e.key === 'e') {
        e.preventDefault()
        handleExplain()
      }
      if (e.key === 'F' || e.key === 'f') {
        e.preventDefault()
        if (hasFixContext) handleFix()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [projectId, readOnly, hasFixContext, activeFile, editorContent, outputLog, deployPanelOpen])

  // Deploy button opens the panel
  const handleDeployToggle = () => {
    setDeployPanelOpen(!deployPanelOpen)
    if (chatOpen) closeChat()
  }

  const handleBeforePush = () => {
    setBottomPanelOpen(true)
    clearLog()
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
    if (fp.endsWith('.md')) return 'markdown'
    if (fp.endsWith('.json')) return 'json'
    if (fp.endsWith('.wasm')) return 'plaintext'
    if (fp.endsWith('.rs')) return 'rust'
    return 'plaintext'
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
          <NetworkToggle />
          <button onClick={handleSave} disabled={isSaving || readOnly}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stellar-surface border border-stellar-border hover:border-stellar-accent/50 text-stellar-muted hover:text-white rounded-md text-xs font-medium transition-all">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Save</span>
          </button>
          <button onClick={handleCompile} disabled={compileStatus === 'running' || readOnly}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stellar-accent hover:bg-stellar-accent-hover text-white rounded-md text-xs font-semibold transition-all disabled:opacity-50">
            {actionIcon(compileStatus, Play)}
            <span className="hidden sm:inline">Compile</span>
          </button>
          <button onClick={handleTest} disabled={testStatus === 'running' || readOnly}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stellar-surface border border-stellar-border hover:border-stellar-accent/50 text-stellar-muted hover:text-white rounded-md text-xs font-medium transition-all disabled:opacity-50">
            {actionIcon(testStatus, TestTube)}
            <span className="hidden sm:inline">Test</span>
          </button>
          <button onClick={handleDeployToggle} disabled={readOnly}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs font-medium transition-all ${
              deployPanelOpen
                ? 'bg-stellar-accent/15 border-stellar-accent/40 text-stellar-accent'
                : 'bg-stellar-surface border-stellar-border text-stellar-muted hover:text-white hover:border-stellar-accent/40'
            }`}>
            {actionIcon(deployStatus, Rocket)}
            <span className="hidden sm:inline">Deploy</span>
          </button>
          <button onClick={handleAudit} disabled={auditStatus === 'running' || readOnly}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stellar-surface border border-stellar-border hover:border-stellar-accent/50 text-stellar-muted hover:text-white rounded-md text-xs font-medium transition-all disabled:opacity-50">
            {actionIcon(auditStatus, Shield)}
            <span className="hidden sm:inline">Audit</span>
          </button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href="/docs/guide"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-stellar-surface border border-stellar-border hover:border-stellar-accent/50 text-stellar-muted hover:text-white rounded-md text-xs font-medium transition-all"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Docs
          </a>
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
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate(`/projects/${projectId}/settings`)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-stellar-surface border border-stellar-border hover:border-stellar-accent/50 rounded-md text-xs text-stellar-muted hover:text-white font-medium transition-all"
              title="Project settings"
            >
              <Settings className="w-3 h-3" />
              <span className="hidden md:inline">Settings</span>
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-md">
              <Users className="w-3 h-3 text-purple-400" />
              <span className="text-xs text-purple-400 font-medium hidden md:inline">
                {presence.length || 1} online
              </span>
            </div>
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
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-stellar-border">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-3.5 h-3.5 text-stellar-accent" />
              <span className="text-xs font-semibold text-stellar-muted uppercase tracking-wide">Explorer</span>
            </div>
            {!readOnly && (
              <button
                type="button"
                title="New file"
                onClick={() => {
                  const name = window.prompt('New file path (e.g. src/helpers.rs)')
                  if (!name?.trim()) return
                  const path = name.trim()
                  sendFileTreeUpdate({
                    action: 'create',
                    file_path: path,
                    content: '',
                    language: path.endsWith('.toml') ? 'toml' : 'rust',
                  })
                }}
                className="text-xs text-stellar-accent hover:underline"
              >
                + File
              </button>
            )}
          </div>
          <FileTree
            files={files}
            activeFile={activeFile}
            onSelect={setActiveFile}
            readOnly={readOnly}
            onDelete={(file) => {
              if (!window.confirm(`Delete ${file.file_path}?`)) return
              sendFileTreeUpdate({ action: 'delete', file_path: file.file_path })
            }}
            onRename={(file) => {
              const newPath = window.prompt('Rename to path:', file.file_path)
              if (!newPath?.trim() || newPath.trim() === file.file_path) return
              sendFileTreeUpdate({
                action: 'rename',
                file_path: newPath.trim(),
                old_path: file.file_path,
              })
            }}
          />
        </div>

        {/* Editor + Output */}
        <div className="flex-1 flex flex-col min-w-0">
          <PresenceBar presence={presence} connectionStatus={connectionStatus} deployLock={deployLock} />
          {project?.github_owner && project?.github_repo ? (
            <GitHubPushBar
              project={project}
              onOpenPush={() => setPushModalOpen(true)}
              readOnly={readOnly}
            />
          ) : (
            <GitHubLinkBar
              onLink={() => setLinkOpen(true)}
              readOnly={readOnly}
              isOwner={role === 'owner'}
            />
          )}
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
                  <p className="text-xs text-stellar-border">Compiled and saved. Ready to deploy.</p>
                </div>
              </div>
            ) : token && user?.id && activeFile ? (
              <CollabEditor
                key={activeFile.file_path}
                projectId={projectId}
                filePath={activeFile.file_path}
                token={token}
                userId={user.id}
                userName={userName}
                userColor={userColorHex}
                initialContent={activeFile.content ?? editorContent}
                language={editorLanguage}
                readOnly={readOnly}
                onContentChange={(content) => setEditorContent(content)}
                onSaveDebounced={(content) =>
                  debouncedSaveFile(projectId, activeFile.file_path, content)
                }
                onFileConnectionStatus={setFileConnectionStatus}
                onSessionRestored={handleSessionRestored}
                editorHighlight={editorHighlight}
              />
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
                  readOnly,
                }}
              />
            )}
          </div>
          {bottomPanelOpen && (
            <div className="border-t border-stellar-border flex-shrink-0 relative" style={{ height: terminalHeight }}>
              <div
                onMouseDown={startDrag}
                className="absolute top-0 left-0 right-0 h-1.5 cursor-row-resize hover:bg-stellar-accent/40 transition-colors z-10"
              />
              {auditPanelOpen && !auditShowTerminal ? (
                <AuditResultsPanel
                  findings={auditFindings}
                  riskLevel={auditRiskLevel}
                  message={auditMessage}
                  onClose={() => setAuditPanelOpen(false)}
                  onSelectFinding={jumpToFinding}
                  onToggleTerminal={() => setAuditShowTerminal(true)}
                  showTerminal={false}
                />
              ) : aiFixPanelOpen ? (
                <AiFixPanel
                  filePath={activeFile?.file_path}
                  proposal={aiFixProposal}
                  status={aiFixStatus}
                  error={aiFixError}
                  readOnly={readOnly}
                  onClose={() => { setAiFixPanelOpen(false); rejectAiFix() }}
                  onRetry={() => fixWithAI(projectId, network)}
                  onApply={handleApplyFix}
                  onReject={rejectAiFix}
                  onToggleFix={toggleAiFixSelection}
                />
              ) : (
                <OutputPanel
                  logs={outputLog}
                  onClear={clearLog}
                  onFix={handleFix}
                  onExplain={handleExplain}
                  hasFixContext={hasFixContext}
                  aiBusy={aiBusy}
                  readOnly={readOnly}
                  compileStatus={compileStatus}
                  testStatus={testStatus}
                  deployStatus={deployStatus}
                  auditStatus={auditStatus}
                  showAuditResultsLink={auditPanelOpen && auditShowTerminal}
                  onShowAuditResults={() => setAuditShowTerminal(false)}
                />
              )}
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
            <ChatPanel onClose={closeChat} projectId={projectId} readOnly={readOnly} />
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <LinkGitHubModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        projectId={projectId}
        onLinked={(p) => {
          setProject(p)
          fetchProjects()
          toast.success('GitHub repository linked')
        }}
      />
      <PushModal
        open={pushModalOpen}
        onClose={() => setPushModalOpen(false)}
        projectId={projectId}
        project={project}
        onBeforePush={handleBeforePush}
        onPushed={() => {
          fetchProjects()
          toast.success('Pushed to GitHub')
        }}
      />
    </div>
  )
}
