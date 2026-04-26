import { ExternalLink, Globe, BookOpen, Zap, MessageSquare, FlaskConical, Search } from 'lucide-react'

const resources = [
  { icon: Globe, label: 'Stellar.org', description: 'The foundation and official home of the Stellar network.', href: 'https://stellar.org', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
  { icon: BookOpen, label: 'Developer Docs', description: 'Comprehensive guides, references, and tutorials for building on Stellar.', href: 'https://developers.stellar.org', color: 'text-stellar-accent', bg: 'bg-stellar-accent/10 border-stellar-accent/20' },
  { icon: Zap, label: 'Soroban Docs', description: 'Everything you need to write and deploy Soroban smart contracts.', href: 'https://developers.stellar.org/docs/build/smart-contracts', color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
  { icon: MessageSquare, label: 'Stellar Discord', description: 'Connect with the dev community, get help, and share your work.', href: 'https://discord.gg/stellardev', color: 'text-indigo-400', bg: 'bg-indigo-400/10 border-indigo-400/20' },
  { icon: FlaskConical, label: 'Stellar Lab', description: 'Experiment with transactions, accounts, and network tools.', href: 'https://lab.stellar.org', color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20' },
  { icon: Search, label: 'Stellar Expert', description: 'Inspect accounts, transactions, and contracts on Stellar networks.', href: 'https://stellar.expert/explorer/public', color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20' },
]

export default function DevResourcesSection() {
  return (
    <section className="py-24 px-4 relative" id="resources">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="inline-block px-3 py-1 text-xs font-semibold text-stellar-accent bg-stellar-accent/10 border border-stellar-accent/20 rounded-full mb-4">
            Developer Resources
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-stellar-heading mb-4">
            Everything you need to build on Stellar
          </h2>
          <p className="text-lg text-stellar-muted max-w-2xl mx-auto">
            Official docs, developer tools, and a thriving community — all in one place.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map((r) => {
            const Icon = r.icon
            return (
              <a
                key={r.label}
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex gap-4 p-5 bg-stellar-card border border-stellar-border rounded-xl hover:border-stellar-accent/30 hover:bg-stellar-surface transition-all duration-200"
              >
                <div className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5 ${r.bg} transition-transform group-hover:scale-110`}>
                  <Icon className={`w-4 h-4 ${r.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="font-semibold text-stellar-heading text-sm group-hover:text-stellar-accent transition-colors">
                      {r.label}
                    </span>
                    <ExternalLink className="w-3 h-3 text-stellar-border group-hover:text-stellar-accent transition-colors flex-shrink-0" />
                  </div>
                  <p className="text-xs text-stellar-muted leading-relaxed">{r.description}</p>
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </section>
  )
}
