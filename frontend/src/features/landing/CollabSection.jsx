import { Link } from 'react-router-dom'
import { Users, Share2, MousePointer2, FolderTree, CheckCircle } from 'lucide-react'
import Button from '../../components/ui/Button'

const highlights = [
  {
    icon: MousePointer2,
    label: 'Live cursors & selections',
    description: 'See teammates in the editor with colored cursors via Yjs awareness.',
  },
  {
    icon: FolderTree,
    label: 'Shared file tree',
    description: 'Create files together — changes sync instantly across all connected clients.',
  },
  {
    icon: Share2,
    label: 'Invite links',
    description: 'Share projects with editor or viewer permissions using secure invite URLs.',
  },
]

export default function CollabSection() {
  return (
    <section className="py-24 border-t border-stellar-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-stellar-card via-stellar-surface to-stellar-card border border-stellar-accent/20 p-12 text-center">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-stellar-accent/10 rounded-full blur-3xl" />
          </div>

          <div className="relative inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 text-sm font-semibold mb-6">
            <CheckCircle className="w-4 h-4" />
            Live Now
          </div>

          <h2 className="relative text-4xl lg:text-5xl font-black text-stellar-heading mb-4">
            Real-time Collaboration
          </h2>
          <p className="relative text-lg text-stellar-muted max-w-2xl mx-auto mb-8">
            Work on Soroban contracts with your team simultaneously — like Google Docs for smart contracts.
            Live cursors, CRDT-based conflict-free editing, shared file trees, and presence indicators are built in.
          </p>

          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto mb-10">
            {highlights.map(({ icon: Icon, label, description }) => (
              <div
                key={label}
                className="flex flex-col items-start gap-2 bg-stellar-bg/50 border border-stellar-border rounded-lg px-4 py-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-stellar-accent flex-shrink-0" />
                  <span className="text-sm font-semibold text-stellar-heading">{label}</span>
                </div>
                <span className="text-xs text-stellar-muted leading-relaxed">{description}</span>
              </div>
            ))}
          </div>

          <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg">
                <Users className="w-5 h-5" />
                Start Collaborating
              </Button>
            </Link>
            <p className="text-sm text-stellar-muted">
              Open any project → click <strong className="text-stellar-text">Share</strong> in the IDE to invite editors or viewers.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
