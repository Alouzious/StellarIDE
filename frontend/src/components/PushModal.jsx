import { useCallback, useEffect, useState } from 'react'
import {
  Loader2, AlertCircle, RefreshCw, Upload, ExternalLink, CheckCircle, XCircle,
} from 'lucide-react'
import useIdeStore from '../features/ide/ideStore'
import Button from './ui/Button'
import Modal from './ui/Modal'
import Input from './ui/Input'

function ChangeList({ dotColor, label, paths }) {
  if (!paths || paths.length === 0) return null
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-stellar-heading">{label} ({paths.length})</p>
      <ul className="space-y-0.5">
        {paths.map((p) => (
          <li key={p} className="flex items-center gap-2 text-xs text-stellar-muted">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
            <span className="truncate" title={p}>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function PushModal({ open, onClose, projectId, project, onBeforePush, onPushed }) {
  const { saveAllFiles, fetchGitHubDiff, fetchPushHistory, pushToGitHub } = useIdeStore()

  const defaultBranch = project?.github_branch || 'main'
  const [branch, setBranch] = useState(defaultBranch)
  const [message, setMessage] = useState('')
  const [openPr, setOpenPr] = useState(false)
  const [prBase, setPrBase] = useState('')
  const [diff, setDiff] = useState(null)
  const [loadingDiff, setLoadingDiff] = useState(false)
  const [diffError, setDiffError] = useState('')
  const [pushing, setPushing] = useState(false)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  const repoUrl = project?.github_owner && project?.github_repo
    ? `https://github.com/${project.github_owner}/${project.github_repo}`
    : null

  const loadDiff = useCallback(async (targetBranch) => {
    setLoadingDiff(true)
    setDiffError('')
    await saveAllFiles(projectId)
    const result = await fetchGitHubDiff(projectId, targetBranch)
    setLoadingDiff(false)
    if (result.success) setDiff(result.diff)
    else setDiffError(result.error)
  }, [projectId, saveAllFiles, fetchGitHubDiff])

  useEffect(() => {
    if (!open) return
    setBranch(defaultBranch)
    setMessage('')
    setOpenPr(false)
    setPrBase('')
    setDiff(null)
    setShowHistory(false)
    loadDiff(defaultBranch)
    fetchPushHistory(projectId).then((r) => setHistory(r.pushes || []))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const isConflict = diff?.conflict
  const hasChanges = diff?.has_changes
  const canPush = !pushing && !loadingDiff && !isConflict && hasChanges && message.trim().length > 0

  const handlePush = async () => {
    if (!canPush) return
    setPushing(true)
    onBeforePush?.()
    const result = await pushToGitHub(projectId, message.trim(), {
      branch: branch.trim() || undefined,
      openPr,
      prBase: prBase.trim() || undefined,
    })
    setPushing(false)
    if (result.success) {
      onPushed?.(result.data)
      onClose()
    } else if (result.conflict) {
      // Remote moved between preview and push — refresh the diff to surface it.
      loadDiff(branch)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Push to GitHub">
      <div className="space-y-4">
        {isConflict && (
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">This repo has new commits on GitHub</p>
              <p className="text-xs mt-1 text-amber-300/80">
                Someone pushed to <span className="font-mono">{diff?.branch}</span> since you last synced.
                Pushing now would overwrite their changes. Re-import the repo, or push to a new branch and open a PR,
                to avoid losing remote work.
              </p>
            </div>
          </div>
        )}

        {diffError && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
            <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {diffError}
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-stellar-heading">Changes to push</p>
          <button
            type="button"
            onClick={() => loadDiff(branch)}
            disabled={loadingDiff}
            className="flex items-center gap-1 text-xs text-stellar-accent hover:underline disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loadingDiff ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="max-h-48 overflow-auto rounded-lg border border-stellar-border bg-stellar-surface/50 p-3 space-y-3">
          {loadingDiff ? (
            <div className="flex items-center justify-center py-6 text-stellar-muted text-sm">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Comparing with GitHub...
            </div>
          ) : !hasChanges ? (
            <p className="text-sm text-stellar-muted text-center py-4">
              No differences from the remote branch.
            </p>
          ) : (
            <>
              <ChangeList dotColor="bg-green-400" label="Added" paths={diff?.added} />
              <ChangeList dotColor="bg-amber-400" label="Modified" paths={diff?.modified} />
              <ChangeList dotColor="bg-red-400" label="Deleted" paths={diff?.deleted} />
            </>
          )}
        </div>

        <Input
          label="Branch"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          placeholder={defaultBranch}
        />

        <label className="flex items-center gap-2 text-sm text-stellar-text cursor-pointer">
          <input
            type="checkbox"
            checked={openPr}
            onChange={(e) => setOpenPr(e.target.checked)}
            className="accent-stellar-accent"
          />
          Open a pull request instead of committing to the branch directly
        </label>

        {openPr && (
          <Input
            label="PR base branch (optional)"
            value={prBase}
            onChange={(e) => setPrBase(e.target.value)}
            placeholder="default branch"
          />
        )}

        <Input
          label="Commit message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your changes"
        />

        <Button className="w-full justify-center" loading={pushing} disabled={!canPush} onClick={handlePush}>
          <Upload className="w-4 h-4" />
          {openPr ? 'Push & open pull request' : 'Push to GitHub'}
        </Button>

        <div>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-xs text-stellar-muted hover:text-stellar-accent"
          >
            {showHistory ? 'Hide' : 'Show'} recent pushes
          </button>
          {showHistory && (
            <div className="mt-2 max-h-40 overflow-auto space-y-1.5">
              {history.length === 0 ? (
                <p className="text-xs text-stellar-muted">No pushes yet.</p>
              ) : (
                history.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-xs">
                    {p.status === 'success'
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                    <span className="text-stellar-muted truncate flex-1" title={p.message}>
                      {p.message}
                    </span>
                    <span className="text-stellar-border">{p.branch}</span>
                    {p.commit_sha && repoUrl && (
                      <a
                        href={`${repoUrl}/commit/${p.commit_sha}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-0.5 text-stellar-accent hover:underline"
                      >
                        {p.commit_sha.slice(0, 7)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
