import { Code2, Zap, Shield, Globe, Terminal, GitBranch, Layers, Cpu } from 'lucide-react'

const features = [
  {
    icon: Code2,
    title: 'Monaco Editor',
    description:
      'Full-featured VS Code-grade editor with Rust syntax highlighting, IntelliSense, and autocomplete.',
    accent: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
  {
    icon: Zap,
    title: 'Instant Compile',
    description:
      'One-click compilation pipeline targeting the Soroban WASM runtime. See errors in real time.',
    accent: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
  },
  {
    icon: Shield,
    title: 'Secure by Default',
    description:
      'JWT authentication, encrypted storage, and isolated contract execution environments.',
    accent: 'text-green-400',
    bg: 'bg-green-400/10',
  },
  {
    icon: Globe,
    title: 'Multi-Network Deploy',
    description:
      'Deploy to Stellar Testnet or Mainnet directly from the browser with wallet integration.',
    accent: 'text-purple-400',
    bg: 'bg-purple-400/10',
  },
  {
    icon: Terminal,
    title: 'Integrated Terminal',
    description:
      'Built-in output panel showing compilation logs, test results, and deployment status.',
    accent: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
  },
  {
    icon: GitBranch,
    title: 'Project Management',
    description:
      'Organize contracts into projects with file trees, versioning, and shared workspaces.',
    accent: 'text-orange-400',
    bg: 'bg-orange-400/10',
  },
  {
    icon: Layers,
    title: 'Soroban SDK Built-in',
    description:
      'Pre-configured Soroban SDK integration so you spend time writing logic, not configuring toolchains.',
    accent: 'text-pink-400',
    bg: 'bg-pink-400/10',
  },
  {
    icon: Cpu,
    title: 'Performant Backend',
    description:
      'Powered by a Rust + Axum backend for blazing-fast API responses and reliable contract execution.',
    accent: 'text-indigo-400',
    bg: 'bg-indigo-400/10',
  },
]

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 border-t border-stellar-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-sm font-semibold text-stellar-accent tracking-widest uppercase">
            Everything you need
          </span>
          <h2 className="mt-3 text-4xl lg:text-5xl font-black text-stellar-heading tracking-tight">
            A complete Soroban development platform
          </h2>
          <p className="mt-4 text-lg text-stellar-muted">
            Every tool a Soroban developer needs, integrated in a single browser-based workspace.
            No local install required.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((feat) => {
            const Icon = feat.icon
            return (
              <div
                key={feat.title}
                className="group bg-stellar-card border border-stellar-border rounded-xl p-6 hover:border-stellar-accent/40 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className={`inline-flex p-2.5 rounded-lg ${feat.bg} mb-4`}>
                  <Icon className={`w-5 h-5 ${feat.accent}`} />
                </div>
                <h3 className="font-semibold text-stellar-heading mb-2">{feat.title}</h3>
                <p className="text-sm text-stellar-muted leading-relaxed">{feat.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
