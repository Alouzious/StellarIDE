import { Users, Clock } from 'lucide-react'

export default function CollabSection() {
  return (
    <section className="py-24 border-t border-stellar-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-stellar-card via-stellar-surface to-stellar-card border border-stellar-accent/20 p-12 text-center">
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-stellar-accent/10 rounded-full blur-3xl" />
          </div>

          <div className="relative inline-flex items-center gap-2 px-4 py-2 bg-stellar-accent/10 border border-stellar-accent/30 rounded-full text-stellar-accent text-sm font-semibold mb-6">
            <Clock className="w-4 h-4" />
            Coming Soon
          </div>

          <h2 className="text-4xl lg:text-5xl font-black text-stellar-heading mb-4">
            Real-time Collaboration
          </h2>
          <p className="text-lg text-stellar-muted max-w-2xl mx-auto mb-8">
            Work on Soroban contracts with your team simultaneously. Live cursors, shared editing, 
            inline comments, and conflict-free merges — all in the browser, no git required.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mx-auto">
            {[
              { label: 'Live cursor sharing', icon: Users },
              { label: 'Shared file tree', icon: Users },
              { label: 'Real-time sync', icon: Clock },
            ].map(({ label }) => (
              <div
                key={label}
                className="flex items-center gap-3 bg-stellar-bg/50 border border-stellar-border rounded-lg px-4 py-3"
              >
                <div className="w-2 h-2 rounded-full bg-stellar-accent/50 flex-shrink-0" />
                <span className="text-sm text-stellar-muted">{label}</span>
              </div>
            ))}
          </div>

          <p className="mt-8 text-sm text-stellar-muted">
            Join the waitlist to be first to access collaborative features when they launch.
          </p>
          <div className="mt-4 flex justify-center">
            <div className="flex overflow-hidden rounded-lg border border-stellar-border max-w-sm w-full">
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 px-4 py-2.5 bg-stellar-surface text-stellar-text text-sm placeholder-stellar-muted focus:outline-none"
              />
              <button className="px-5 py-2.5 bg-stellar-accent hover:bg-stellar-accent-hover text-white text-sm font-semibold transition-colors">
                Notify me
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
