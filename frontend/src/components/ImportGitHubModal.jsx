import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, Search, ExternalLink, AlertCircle, FolderOpen, Package, ChevronRight,
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
          {isRoot && 'Cargo.toml at repo root'}
          {!isRoot && hasCargo && 'Contains Cargo.toml likely Soroban contract'}
          {!isRoot && !hasCargo && 'Subfolder'}
          {suggested && !isRoot && ' · suggested'}
        </p>
      </div>
      {active && <ChevronRight className="w-4 h-4 text-stellar-accent flex-shrink-0" />}
    </button>
  )
}

export default function ImportGitHubModal({ open, onClose, onImported }) {
  const navigate = useNavigate()
  const {
    status,
    repos,
    loading,
    importing,
    error,
    fetchStatus,
    connectGitHub,
    startGitHubLogin,
    fetchRepos,
    fetchRepoFolders,
    importRepo,
  } = useGitHubStore()

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [step, setStep] = useState('repos')
  const [branch, setBranch] = useState('')
  const [projectName, setProjectName] = useState('')
  const [subfolder, setSubfolder] = useState('')
  const [folderMeta, setFolderMeta] = useState(null)
  const [loadingFolders, setLoadingFolders] = useState(false)
  const [folderError, setFolderError] = useState('')
  const [checking, setChecking] = useState(true)
  const [importResult, setImportResult] = useState(null)

  useEffect(() => {
    if (!open) return
    setChecking(true)
    setSelected(null)
    setSearch('')
    setStep('repos')
    setSubfolder('')
    setFolderMeta(null)
    setFolderError('')
    setImportResult(null)
    fetchStatus().then((s) => {
      setChecking(false)
      if (s?.connected) fetchRepos()
    })
  }, [open, fetchStatus, fetchRepos])

  const filtered = repos.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelectRepo = async (repo) => {
    setSelected(repo)
    setBranch(repo.default_branch || 'main')
    setProjectName(repo.name || '')
    setFolderError('')
    setLoadingFolders(true)

    const owner = repo.owner?.login || repo.full_name.split('/')[0]
    const result = await fetchRepoFolders(owner, repo.name, repo.default_branch)

    setLoadingFolders(false)
    if (!result.success) {
      setFolderError(result.error)
      setStep('config')
      return
    }

    setFolderMeta(result)
    if (result.isFlat) {
      setSubfolder('')
      setStep('config')
    } else if (result.folders?.length > 0) {
      const suggested = result.folders.find((f) => f.suggested)
      setSubfolder(suggested?.name || '')
      setStep('folder')
    } else {
      setSubfolder('')
      setStep('config')
    }
  }

  const handleImport = async () => {
    if (!selected) return
    const owner = selected.owner?.login || selected.full_name.split('/')[0]
    const result = await importRepo(
      owner,
      selected.name,
      branch,
      projectName,
      subfolder || undefined
    )
    if (result.success) {
      onImported?.(result.project)
      // If GitHub truncated the tree or some files were skipped, pause on a summary
      // so the user knows before jumping into the editor.
      if (result.warning || result.filesSkipped > 0) {
        setImportResult(result)
      } else {
        onClose()
        navigate(`/ide/${result.project.id}`)
      }
    }
  }

  const goToEditor = () => {
    const project = importResult?.project
    setImportResult(null)
    onClose()
    if (project) navigate(`/ide/${project.id}`)
  }

  const renderFolderStep = () => (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => { setSelected(null); setStep('repos') }}
        className="text-xs text-stellar-accent hover:underline"
      >
        ← Back to repo list
      </button>
      <div>
        <p className="text-sm font-semibold text-stellar-heading">{selected.full_name}</p>
        <p className="text-xs text-stellar-muted mt-1">
          Select the folder that contains your Soroban contract (Cargo.toml + src/).
        </p>
      </div>
      {loadingFolders ? (
        <div className="flex items-center justify-center py-8 text-stellar-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Scanning repository...
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-auto">
          {folderMeta?.hasRootCargo && (
            <FolderOption folder={null} selected={subfolder} onSelect={setSubfolder} />
          )}
          {(folderMeta?.folders || []).map((folder) => (
            <FolderOption
              key={folder.name}
              folder={folder}
              selected={subfolder}
              onSelect={setSubfolder}
            />
          ))}
        </div>
      )}
      <Button
        className="w-full justify-center"
        disabled={!subfolder && !folderMeta?.hasRootCargo}
        onClick={() => setStep('config')}
      >
        Continue
      </Button>
    </div>
  )

  const renderConfigStep = () => (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => {
          if (folderMeta?.folders?.length > 0 && !folderMeta?.isFlat) setStep('folder')
          else { setSelected(null); setStep('repos') }
        }}
        className="text-xs text-stellar-accent hover:underline"
      >
        ← Back
      </button>
      <p className="text-sm font-semibold text-stellar-heading">{selected.full_name}</p>
      {subfolder && (
        <p className="text-xs text-stellar-muted">
          Contract folder: <span className="text-stellar-accent font-medium">{subfolder}/</span>
        </p>
      )}
      {folderError && (
        <p className="text-xs text-amber-400">{folderError} you can still import manually.</p>
      )}
      <Input
        label="Project name"
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
      />
      <Input
        label="Branch"
        value={branch}
        onChange={(e) => setBranch(e.target.value)}
        placeholder={selected.default_branch || 'main'}
      />
      <Button className="w-full justify-center" loading={importing} onClick={handleImport}>
        Import contract folder
      </Button>
    </div>
  )

  const renderBody = () => {
    if (checking) {
      return (
        <div className="flex items-center justify-center py-12 text-stellar-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Checking GitHub connection...
        </div>
      )
    }

    if (importResult) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-stellar-heading font-semibold">
            <Package className="w-4 h-4 text-stellar-accent" />
            Imported {importResult.filesImported} file(s)
          </div>
          {importResult.warning && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {importResult.warning}
            </div>
          )}
          {importResult.filesSkipped > 0 && (
            <div className="text-xs text-stellar-muted">
              <p className="mb-1">{importResult.filesSkipped} file(s) were skipped:</p>
              <div className="max-h-40 overflow-auto space-y-0.5 border border-stellar-border rounded-lg p-2">
                {importResult.skipped.map((s) => (
                  <div key={s.path} className="flex items-center justify-between gap-2">
                    <span className="truncate" title={s.path}>{s.path}</span>
                    <span className="text-stellar-border flex-shrink-0">
                      {s.reason === 'too_large' ? 'too large' : s.reason === 'binary' ? 'binary' : 'failed'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <Button className="w-full justify-center" onClick={goToEditor}>
            Continue to editor
          </Button>
        </div>
      )
    }

    if (!status?.connected) {
      return (
        <div className="space-y-4 text-center py-4">
          <div className="w-12 h-12 rounded-xl bg-stellar-surface border border-stellar-border flex items-center justify-center mx-auto">
            <GitHubIcon className="w-6 h-6 text-stellar-text" />
          </div>
          {status?.reason && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 text-left">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {status.reason}
            </div>
          )}
          <p className="text-sm text-stellar-muted">
            Connect your GitHub account to import repositories into StellarIDE.
          </p>
          <div className="flex flex-col gap-2">
            <Button className="w-full justify-center" onClick={startGitHubLogin}>
              <GitHubIcon className="w-4 h-4" />
              Sign in with GitHub
            </Button>
            <Button variant="secondary" className="w-full justify-center" onClick={connectGitHub}>
              Connect GitHub to existing account
            </Button>
          </div>
        </div>
      )
    }

    if (step === 'folder' && selected) return renderFolderStep()
    if (step === 'config' && selected) return renderConfigStep()

    return (
      <div className="space-y-4">
        <p className="text-xs text-stellar-muted">
          Connected as <span className="text-stellar-accent font-medium">{status.github_login}</span>
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stellar-muted" />
          <input
            type="text"
            placeholder="Search repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-stellar-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading repositories...
          </div>
        ) : (
          <div className="max-h-64 overflow-auto space-y-1 border border-stellar-border rounded-lg p-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-stellar-muted text-center py-6">No repositories found</p>
            ) : (
              filtered.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelectRepo(r)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-stellar-surface text-left transition-colors group"
                >
                  <GitHubIcon className="w-4 h-4 text-stellar-muted flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stellar-heading truncate">{r.full_name}</p>
                    <p className="text-xs text-stellar-muted">
                      {r.private ? 'Private' : 'Public'} · {r.default_branch}
                    </p>
                  </div>
                  <a
                    href={r.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="opacity-0 group-hover:opacity-100 text-stellar-muted hover:text-stellar-accent"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Import from GitHub">
      {error && (
        <div className="mb-4 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {renderBody()}
    </Modal>
  )
}
