import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Copy, ExternalLink, Link2, Loader2,
  Settings, Trash2, Users, AlertTriangle,
} from 'lucide-react'
import useAuthStore from '../features/auth/authStore'
import useDashboardStore from '../features/dashboard/dashboardStore'
import useCollabStore from '../features/collab/collabStore'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { ToastContainer } from '../components/ui/Toast'
import useToast from '../hooks/useToast'

function SettingsSection({ title, description, children, danger }) {
  return (
    <section
      className={`rounded-xl border p-6 ${
        danger
          ? 'border-red-500/30 bg-red-500/5'
          : 'border-stellar-border bg-stellar-card'
      }`}
    >
      <div className="mb-5">
        <h2 className={`text-lg font-semibold ${danger ? 'text-red-400' : 'text-stellar-heading'}`}>
          {title}
        </h2>
        {description && <p className="text-sm text-stellar-muted mt-1">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export default function ProjectSettingsPage() {
  const { id: projectId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { getProject, updateProject, deleteProject } = useDashboardStore()
  const {
    fetchRole, createInvite, listCollaborators,
    updateCollaboratorRole, removeCollaborator,
  } = useCollabStore()
  const { toasts, toast, removeToast } = useToast()

  const [project, setProject] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState('')

  const [collaborators, setCollaborators] = useState([])
  const [inviteRole, setInviteRole] = useState('editor')
  const [inviteUrl, setInviteUrl] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [collabActionId, setCollabActionId] = useState(null)

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  const isOwner = role === 'owner'

  const loadCollaborators = useCallback(async () => {
    const result = await listCollaborators(projectId)
    if (result.success) setCollaborators(result.collaborators)
  }, [projectId, listCollaborators])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [projectResult, userRole] = await Promise.all([
        getProject(projectId),
        fetchRole(projectId),
      ])
      if (cancelled) return
      if (!projectResult.success) {
        toast.error(projectResult.error || 'Project not found')
        navigate('/dashboard')
        return
      }
      setProject(projectResult.project)
      setName(projectResult.project.name)
      setDescription(projectResult.project.description || '')
      setRole(userRole)
      setLoading(false)
      await loadCollaborators()
    }
    load()
    return () => { cancelled = true }
  }, [projectId, getProject, fetchRole, loadCollaborators, navigate, toast])

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError('Project name is required')
      return
    }
    setSaving(true)
    const result = await updateProject(projectId, {
      name: name.trim(),
      description: description.trim() || undefined,
    })
    setSaving(false)
    if (result.success) {
      setProject((p) => ({ ...p, name: name.trim(), description: description.trim() || null }))
      toast.success('Project updated')
    } else {
      toast.error(result.error)
    }
  }

  const handleGenerateInvite = async () => {
    setInviteLoading(true)
    const result = await createInvite(projectId, inviteRole)
    setInviteLoading(false)
    if (result.success) {
      setInviteUrl(result.invite_url)
      toast.success('Invite link generated')
    } else {
      toast.error(result.error)
    }
  }

  const handleCopyInvite = () => {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRoleChange = async (userId, newRole) => {
    setCollabActionId(userId)
    const result = await updateCollaboratorRole(projectId, userId, newRole)
    setCollabActionId(null)
    if (result.success) {
      setCollaborators((list) =>
        list.map((c) => (c.user_id === userId ? { ...c, role: newRole } : c))
      )
      toast.success('Role updated')
    } else {
      toast.error(result.error)
    }
  }

  const handleRemoveCollaborator = async (userId, email) => {
    if (!window.confirm(`Remove ${email} from this project?`)) return
    setCollabActionId(userId)
    const result = await removeCollaborator(projectId, userId)
    setCollabActionId(null)
    if (result.success) {
      setCollaborators((list) => list.filter((c) => c.user_id !== userId))
      toast.success('Collaborator removed')
    } else {
      toast.error(result.error)
    }
  }

  const handleDelete = async () => {
    if (deleteConfirm !== project?.name) return
    setDeleting(true)
    const result = await deleteProject(projectId)
    setDeleting(false)
    if (result.success) {
      toast.success('Project deleted')
      navigate('/dashboard')
    } else {
      toast.error(result.error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stellar-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-stellar-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stellar-bg">
      <header className="border-b border-stellar-border bg-stellar-surface sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/dashboard"
              className="p-2 text-stellar-muted hover:text-white hover:bg-stellar-card rounded-md transition-colors"
              title="Back to dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <p className="text-xs text-stellar-muted flex items-center gap-1">
                <Settings className="w-3 h-3" />
                Project settings
              </p>
              <h1 className="font-semibold text-stellar-heading truncate">{project?.name}</h1>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/ide/${projectId}`)}>
            <ExternalLink className="w-3.5 h-3.5" />
            Open IDE
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {!isOwner && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
            You are a <span className="font-semibold capitalize">{role}</span> on this project.
            Only the owner can change settings or manage collaborators.
          </div>
        )}

        <SettingsSection
          title="General"
          description="Rename your project or update its description."
        >
          <div className="space-y-4">
            <Input
              label="Project name"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError('') }}
              error={nameError}
              disabled={!isOwner}
            />
            <Input
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!isOwner}
            />
            {isOwner && (
              <div className="flex justify-end pt-2">
                <Button loading={saving} onClick={handleSave}>
                  Save changes
                </Button>
              </div>
            )}
          </div>
        </SettingsSection>

        <SettingsSection
          title="Collaborators"
          description="Invite teammates with editor or viewer access."
        >
          {isOwner ? (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="text-xs text-stellar-muted block mb-1.5">Invite as</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="editor">Editor — can edit, compile, and deploy</option>
                    <option value="viewer">Viewer — read-only access</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button loading={inviteLoading} onClick={handleGenerateInvite}>
                    <Link2 className="w-4 h-4" />
                    Generate invite link
                  </Button>
                </div>
              </div>

              {inviteUrl && (
                <div className="flex gap-2">
                  <input readOnly value={inviteUrl} className="input-field flex-1 text-xs" />
                  <Button variant="secondary" onClick={handleCopyInvite}>
                    <Copy className="w-4 h-4" />
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              )}

              <div className="pt-4 border-t border-stellar-border">
                <p className="text-xs font-semibold text-stellar-muted uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  People with access ({collaborators.length})
                </p>
                {collaborators.length === 0 ? (
                  <p className="text-sm text-stellar-muted">No collaborators yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {collaborators.map((c) => {
                      const isProjectOwner = c.role === 'owner'
                      const isSelf = c.user_id === user?.id
                      const busy = collabActionId === c.user_id
                      return (
                        <li
                          key={c.user_id}
                          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg bg-stellar-surface border border-stellar-border"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-stellar-text truncate">
                              {c.email}
                              {isSelf && (
                                <span className="text-stellar-muted ml-1">(you)</span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isProjectOwner ? (
                              <span className="text-xs px-2 py-1 rounded-md bg-stellar-accent/10 text-stellar-accent border border-stellar-accent/20 capitalize">
                                Owner
                              </span>
                            ) : (
                              <>
                                <select
                                  value={c.role}
                                  onChange={(e) => handleRoleChange(c.user_id, e.target.value)}
                                  disabled={busy}
                                  className="input-field text-xs py-1.5 w-28"
                                >
                                  <option value="editor">Editor</option>
                                  <option value="viewer">Viewer</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCollaborator(c.user_id, c.email)}
                                  disabled={busy}
                                  className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-50"
                                  title="Remove collaborator"
                                >
                                  {busy ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-stellar-muted uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                People with access
              </p>
              <ul className="space-y-2">
                {collaborators.map((c) => (
                  <li
                    key={c.user_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-stellar-surface border border-stellar-border text-sm"
                  >
                    <span className="truncate">{c.email}</span>
                    <span className="text-stellar-muted capitalize flex-shrink-0 ml-2">{c.role}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SettingsSection>

        {isOwner && (
          <SettingsSection
            title="Danger zone"
            description="Permanently delete this project and all its files."
            danger
          >
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">
                  Deleting <strong>{project?.name}</strong> cannot be undone. All files,
                  deploy history, and collaborator access will be removed permanently.
                </p>
              </div>
              <Input
                label={`Type "${project?.name}" to confirm`}
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={project?.name}
              />
              <Button
                variant="danger"
                loading={deleting}
                disabled={deleteConfirm !== project?.name}
                onClick={handleDelete}
              >
                <Trash2 className="w-4 h-4" />
                Delete project permanently
              </Button>
            </div>
          </SettingsSection>
        )}
      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
