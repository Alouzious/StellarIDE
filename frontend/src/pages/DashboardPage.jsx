import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Plus, Code2, Trash2, Edit3, ExternalLink, FolderOpen,
  Clock, LogOut, Search, MoreVertical
} from 'lucide-react'
import useAuthStore from '../features/auth/authStore'
import useDashboardStore from '../features/dashboard/dashboardStore'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import { ToastContainer } from '../components/ui/Toast'
import useToast from '../hooks/useToast'

function ProjectCard({ project, onEdit, onDelete, onOpen }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const updatedAt = new Date(project.updated_at || project.created_at).toLocaleDateString()

  return (
    <div className="group bg-stellar-card border border-stellar-border rounded-xl p-5 hover:border-stellar-accent/40 transition-all duration-200 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-stellar-accent/10 border border-stellar-accent/20 flex items-center justify-center flex-shrink-0">
            <Code2 className="w-4 h-4 text-stellar-accent" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-stellar-heading truncate">{project.name}</h3>
            {project.description && (
              <p className="text-xs text-stellar-muted truncate mt-0.5">{project.description}</p>
            )}
          </div>
        </div>
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 text-stellar-muted hover:text-white hover:bg-stellar-surface rounded-md transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 w-36 bg-stellar-surface border border-stellar-border rounded-lg shadow-xl z-10 py-1">
              <button
                onClick={() => { onEdit(project); setMenuOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-stellar-muted hover:text-white hover:bg-stellar-card transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" /> Rename
              </button>
              <button
                onClick={() => { onDelete(project); setMenuOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-stellar-card transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-stellar-muted">
        <Clock className="w-3 h-3" />
        <span>Updated {updatedAt}</span>
      </div>

      <Button
        variant="secondary"
        size="sm"
        className="w-full justify-center"
        onClick={() => onOpen(project)}
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Open in IDE
      </Button>
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { projects, loading, fetchProjects, createProject, updateProject, deleteProject } = useDashboardStore()
  const { toasts, toast, removeToast } = useToast()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async () => {
    if (!formData.name.trim()) { setFormError('Project name is required'); return }
    setSubmitting(true)
    const result = await createProject(formData.name.trim(), formData.description.trim())
    setSubmitting(false)
    if (result.success) {
      toast.success('Project created!')
      setCreateOpen(false)
      setFormData({ name: '', description: '' })
    } else {
      toast.error(result.error)
    }
  }

  const handleEdit = async () => {
    if (!formData.name.trim()) { setFormError('Project name is required'); return }
    setSubmitting(true)
    const result = await updateProject(editTarget.id, { name: formData.name.trim(), description: formData.description.trim() })
    setSubmitting(false)
    if (result.success) {
      toast.success('Project updated!')
      setEditTarget(null)
      setFormData({ name: '', description: '' })
    } else {
      toast.error(result.error)
    }
  }

  const handleDelete = async () => {
    setSubmitting(true)
    const result = await deleteProject(deleteTarget.id)
    setSubmitting(false)
    if (result.success) {
      toast.success('Project deleted')
      setDeleteTarget(null)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="min-h-screen bg-stellar-bg">
      {/* Header */}
      <header className="border-b border-stellar-border bg-stellar-surface sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-stellar-accent/20 border border-stellar-accent/30 flex items-center justify-center">
              <Code2 className="w-4 h-4 text-stellar-accent" />
            </div>
            <span className="font-bold text-stellar-heading">
              Stellar<span className="text-stellar-accent">IDE</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-stellar-muted hidden sm:block">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Welcome */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-stellar-heading">
              Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}
            </h1>
            <p className="text-sm text-stellar-muted mt-1">Manage your Soroban contract projects</p>
          </div>
          <Button onClick={() => { setFormData({ name: '', description: '' }); setFormError(''); setCreateOpen(true) }}>
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stellar-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>

        {/* Projects grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-stellar-card border border-stellar-border rounded-xl p-5 animate-pulse h-44" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <FolderOpen className="w-12 h-12 text-stellar-border mb-4" />
            <p className="text-stellar-muted font-medium">
              {search ? 'No projects match your search' : 'No projects yet'}
            </p>
            {!search && (
              <p className="text-sm text-stellar-muted mt-1 mb-6">
                Create your first Soroban contract project to get started.
              </p>
            )}
            {!search && (
              <Button onClick={() => { setFormData({ name: '', description: '' }); setFormError(''); setCreateOpen(true) }}>
                <Plus className="w-4 h-4" />
                Create Project
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={(p) => navigate(`/ide/${p.id}`)}
                onEdit={(p) => { setEditTarget(p); setFormData({ name: p.name, description: p.description || '' }); setFormError('') }}
                onDelete={(p) => setDeleteTarget(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Project">
        <div className="space-y-4">
          <Input
            label="Project name"
            placeholder="my-token-contract"
            value={formData.name}
            onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setFormError('') }}
            error={formError}
            autoFocus
          />
          <Input
            label="Description (optional)"
            placeholder="A brief description of your contract"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1 justify-center" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1 justify-center" loading={submitting} onClick={handleCreate}>
              Create
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Rename Project">
        <div className="space-y-4">
          <Input
            label="Project name"
            value={formData.name}
            onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setFormError('') }}
            error={formError}
            autoFocus
          />
          <Input
            label="Description (optional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1 justify-center" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button className="flex-1 justify-center" loading={submitting} onClick={handleEdit}>
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Project">
        <div className="space-y-4">
          <p className="text-sm text-stellar-muted">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-stellar-heading">{deleteTarget?.name}</span>?{' '}
            This action cannot be undone.
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1 justify-center" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" className="flex-1 justify-center" loading={submitting} onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
