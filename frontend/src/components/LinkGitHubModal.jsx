import { useEffect, useState } from 'react'
import {
  Loader2, AlertCircle, FolderOpen, Package, ChevronRight, Link2,
} from 'lucide-react'
import useGitHubStore from '../features/github/githubStore'
import GitHubIcon from './icons/GitHubIcon'
import Button from './ui/Button'
import Modal from './ui/Modal'
import Input from './ui/Input'

function FolderOption({ folder, selected, onSelect }) {
  const isRoot = folder === null
  const name = isRoot ? 'Repository root' : folder.name
  const suggested = isRoot ? false : folder.suggested
  const hasCargo = isRoot ? false : folder.has_cargo_toml
  const value = isRoot ? '' : folder.name
  const active = selected === value

  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg border text-left transition-all ${
        active
          ? 'border-stellar-accent bg-stellar-accent/10'
          : suggested
            ? 'border-stellar-accent/40 bg-stellar-surface hover:border-stellar-accent/60'
            : 'border-stellar-border bg-stellar-card hover:border-stellar-accent/30'
      }`}
    >
      <div className={`p-2 rounded-md ${active ? 'bg-stellar-accent/20' : 'bg-stellar-surface'}`}>
        {hasCargo ? (
          <Package className="w-4 h-4 text-stellar-accent" />
        ) : (
          <FolderOpen className="w-4 h-4 text-stellar-muted" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stellar-heading">{name}</p>
        <p className="text-xs text-stellar-muted">
          {!isRoot && hasCargo && 'Contains Cargo.toml'}
          {suggested && !isRoot && ' · suggested'}
        </p>
      </div>
      {active && <ChevronRight className="w-4 h-4 text-stellar-accent flex-shrink-0" />}
    </button>
  )
}

export default function LinkGitHubModal({ open, onClose, projectId, onLinked }) {
  const {
    status,
    linking,
    error,
    fetchStatus,
    connectGitHub,
    startGitHubLogin,
    fetchRepoFolders,
    linkProjectRepo,
  } = useGitHubStore()

  const [repoUrl, setRepoUrl] = useState('')
  const [branch, setBranch] = useState('main')
  const [subfolder, setSubfolder] = useState('')
  const [folderMeta, setFolderMeta] = useState(null)
  const [loadingFolders, setLoadingFolders] = useState(false)
  const [localError, setLocalError] = useState('')
  const [checking, setChecking] = useState(true)
  const [showFolders, setShowFolders] = useState(false)

  useEffect(() => {
    if (!open) return
    setChecking(true)
    setRepoUrl('')
    setBranch('main')
    setSubfolder('')
    setFolderMeta(null)
    setShowFolders(false)
    setLocalError('')
    fetchStatus().then(() => setChecking(false))
  }, [open, fetchStatus])

  const parseRepo = (url) => {
    const trimmed = url.trim().replace(/\/$/, '')
    if (trimmed.includes('github.com/')) {
      const parts = trimmed.split('github.com/')[1]?.split('/').filter(Boolean) || []
      if (parts.length >= 2) return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') }
    }
    const parts = trimmed.split('/').filter(Boolean)
    if (parts.length === 2) return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') }
    return null
  }

  const handleScanFolders = async () => {
    const parsed = parseRepo(repoUrl)
    if (!parsed) {
      setLocalError('Enter a valid GitHub URL (https://github.com/owner/repo or owner/repo)')
      return
    }
    setLocalError('')
    setLoadingFolders(true)
    const result = await fetchRepoFolders(parsed.owner, parsed.repo, branch)
    setLoadingFolders(false)
    if (!result.success) {
      setLocalError(result.error)
      return
    }
    setFolderMeta(result)
    setBranch(result.branch || branch)
    const suggested = result.folders?.find((f) => f.suggested)
    setSubfolder(suggested?.name || '')
    setShowFolders(true)
  }

  const handleLink = async () => {
    const parsed = parseRepo(repoUrl)
    if (!parsed) {
      setLocalError('Enter a valid GitHub URL')
      return
    }
    const result = await linkProjectRepo(
      projectId,
      repoUrl.trim(),
      branch,
      subfolder || undefined
    )
    if (result.success) {
      onLinked?.(result.project)
      onClose()
    }
  }

  const renderBody = () => {
    if (checking) {
      return (
        <div className="flex items-center justify-center py-10 text-stellar-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Checking GitHub...
        </div>
      )
    }

    if (!status?.connected) {
      return (
        <div className="space-y-4 text-center py-4">
          <GitHubIcon className="w-8 h-8 mx-auto text-stellar-text" />
          {status?.reason && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 text-left">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {status.reason}
            </div>
          )}
          <p className="text-sm text-stellar-muted">Connect GitHub to link this project to a repo.</p>
          <Button className="w-full justify-center" onClick={startGitHubLogin}>
            Sign in with GitHub
          </Button>
          <Button variant="secondary" className="w-full justify-center" onClick={connectGitHub}>
            Connect to existing account
          </Button>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <Input
          label="GitHub repository"
          placeholder="https://github.com/owner/repo or owner/repo"
          value={repoUrl}
          onChange={(e) => { setRepoUrl(e.target.value); setShowFolders(false) }}
        />
        <Input
          label="Branch"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          placeholder="main"
        />
        <Button variant="secondary" className="w-full justify-center" onClick={handleScanFolders} loading={loadingFolders}>
          Scan folders
        </Button>
        {showFolders && folderMeta && (
          <div className="space-y-2">
            <p className="text-xs text-stellar-muted">Contract subfolder (optional for flat repos):</p>
            {folderMeta.hasRootCargo && (
              <FolderOption folder={null} selected={subfolder} onSelect={setSubfolder} />
            )}
            {(folderMeta.folders || []).map((folder) => (
              <FolderOption
                key={folder.name}
                folder={folder}
                selected={subfolder}
                onSelect={setSubfolder}
              />
            ))}
          </div>
        )}
        <Button className="w-full justify-center" loading={linking} onClick={handleLink}>
          <Link2 className="w-4 h-4" />
          Link repository
        </Button>
      </div>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Link GitHub Repository">
      {(error || localError) && (
        <div className="mb-4 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {localError || error}
        </div>
      )}
      {renderBody()}
    </Modal>
  )
}
