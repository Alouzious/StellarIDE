import { Star } from 'lucide-react'

const testimonials = [
  {
    name: 'Alex Chen',
    role: 'Soroban Developer',
    avatar: 'AC',
    quote:
      'StellarIDE cut my Soroban setup time from hours to zero. I went from idea to deployed contract in one afternoon.',
    stars: 5,
  },
  {
    name: 'Maria Santos',
    role: 'Blockchain Engineer',
    avatar: 'MS',
    quote:
      'The Monaco editor feels exactly like VS Code, but I can share a project link with my team and we\'re all in the same workspace instantly.',
    stars: 5,
  },
  {
    name: 'Dev Patel',
    role: 'DeFi Protocol Builder',
    avatar: 'DP',
    quote:
      'The integrated compile → test → deploy pipeline is the single best DX improvement I\'ve had in years of on-chain development.',
    stars: 5,
  },
]

export default function TrustSection() {
  return (
    <section className="py-24 border-t border-stellar-border bg-stellar-surface/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-sm font-semibold text-stellar-accent tracking-widest uppercase">
            Testimonials
          </span>
          <h2 className="mt-3 text-4xl lg:text-5xl font-black text-stellar-heading tracking-tight">
            Loved by Stellar developers
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-stellar-card border border-stellar-border rounded-xl p-6 flex flex-col gap-4"
            >
              <div className="flex gap-1">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-stellar-muted leading-relaxed text-sm flex-1">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-3 pt-2 border-t border-stellar-border">
                <div className="w-9 h-9 rounded-full bg-stellar-accent/20 border border-stellar-accent/30 flex items-center justify-center text-xs font-bold text-stellar-accent">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-stellar-heading">{t.name}</p>
                  <p className="text-xs text-stellar-muted">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="mt-16 flex flex-wrap justify-center items-center gap-8">
          {['Stellar Network', 'Soroban SDK', 'WASM Runtime', 'Rust Ecosystem', 'PostgreSQL'].map((badge) => (
            <div
              key={badge}
              className="flex items-center gap-2 px-4 py-2 bg-stellar-card border border-stellar-border rounded-full text-sm text-stellar-muted"
            >
              <div className="w-2 h-2 rounded-full bg-stellar-accent/60" />
              {badge}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
