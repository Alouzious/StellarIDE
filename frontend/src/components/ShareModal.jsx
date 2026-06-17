import { useEffect, useState } from 'react'
import { Copy, Link2, Users } from 'lucide-react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import useCollabStore from '../features/collab/collabStore'

export default function ShareModal({ open, onClose, projectId }) {
  const { createInvite, listCollaborators, isOwner } = useCollabStore()
  const [role, setRole] = useState('editor')
  const [inviteUrl, setInviteUrl] = useState('')
  const [collaborators, setCollaborators] = useState([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open || !projectId) return
    listCollaborators(projectId).then((result) => {
      if (result.success) setCollaborators(result.collaborators)
    })
  }, [open, projectId, listCollaborators])

  const handleGenerate = async () => {
    setLoading(true)
    const result = await createInvite(projectId, role)
    setLoading(false)
    if (result.success) setInviteUrl(result.invite_url)
  }

  const handleCopy = () => {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isOwner()) return null

  return (
    <Modal open={open} onClose={onClose} title="Share Project">
      <div className="space-y-4">
        <div>
          <label className="text-xs text-stellar-muted block mb-1.5">Invite as</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="input-field w-full"
          >
            <option value="editor">Editor — can edit and push</option>
            <option value="viewer">Viewer — read-only</option>
          </select>
        </div>

        <Button className="w-full justify-center" loading={loading} onClick={handleGenerate}>
          <Link2 className="w-4 h-4" />
          Generate invite link
        </Button>

        {inviteUrl && (
          <div className="flex gap-2">
            <input readOnly value={inviteUrl} className="input-field flex-1 text-xs" />
            <Button variant="secondary" onClick={handleCopy}>
              <Copy className="w-4 h-4" />
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        )}

        {collaborators.length > 0 && (
          <div className="pt-2 border-t border-stellar-border">
            <p className="text-xs font-semibold text-stellar-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              People with access
            </p>
            <ul className="space-y-1.5">
              {collaborators.map((c) => (
                <li key={c.user_id} className="flex items-center justify-between text-xs">
                  <span className="text-stellar-text truncate">{c.email}</span>
                  <span className="text-stellar-muted capitalize flex-shrink-0 ml-2">{c.role}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}
