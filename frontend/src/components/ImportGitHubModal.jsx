import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Search, ExternalLink, AlertCircle } from 'lucide-react'
import useGitHubStore from '../features/github/githubStore'
import GitHubIcon from './icons/GitHubIcon'
import Button from './ui/Button'
import Modal from './ui/Modal'
import Input from './ui/Input'

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
    importRepo,
  } = useGitHubStore()

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [branch, setBranch] = useState('')
  const [projectName, setProjectName] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!open) return
    setChecking(true)
    setSelected(null)
    setSearch('')
    fetchStatus().then((s) => {
      setChecking(false)
      if (s?.connected) fetchRepos()
    })
  }, [open, fetchStatus, fetchRepos])

  useEffect(() => {
    if (selected) {
      setBranch(selected.default_branch || 'main')
      setProjectName(selected.name || '')
    }
  }, [selected])

  const filtered = repos.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  )

  const handleImport = async () => {
    if (!selected) return
    const owner = selected.owner?.login || selected.full_name.split('/')[0]
    const result = await importRepo(owner, selected.name, branch, projectName)
    if (result.success) {
      onImported?.(result.project)
      onClose()
      navigate(`/ide/${result.project.id}`)
    }
  }

  const renderBody = () => {
    if (checking) {
      return (
        <div className="flex items-center justify-center py-12 text-stellar-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Checking GitHub connection...
        </div>
      )
    }

    if (!status?.connected) {
      return (
        <div className="space-y-4 text-center py-4">
          <div className="w-12 h-12 rounded-xl bg-stellar-surface border border-stellar-border flex items-center justify-center mx-auto">
            <GitHubIcon className="w-6 h-6 text-stellar-text" />
          </div>
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

    return (
      <div className="space-y-4">
        <p className="text-xs text-stellar-muted">
          Connected as <span className="text-stellar-accent font-medium">{status.github_login}</span>
        </p>

        {!selected ? (
          <>
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
                      onClick={() => setSelected(r)}
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
          </>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs text-stellar-accent hover:underline"
            >
              ← Back to repo list
            </button>
            <p className="text-sm font-semibold text-stellar-heading">{selected.full_name}</p>
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
            <Button
              className="w-full justify-center"
              loading={importing}
              onClick={handleImport}
            >
              Import into StellarIDE
            </Button>
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
