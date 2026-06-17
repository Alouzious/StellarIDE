import { UserPlus, Code2, Play, Rocket, Users } from 'lucide-react'

const steps = [
  {
    icon: UserPlus,
    step: '01',
    title: 'Create an Account',
    description: 'Sign up with email or GitHub/Google OAuth — no credit card, no CLI install.',
  },
  {
    icon: Code2,
    step: '02',
    title: 'Write Your Contract',
    description: 'Use Monaco with Rust + Soroban SDK support, or import an existing repo from GitHub.',
  },
  {
    icon: Play,
    step: '03',
    title: 'Compile & Test',
    description: 'One-click WASM compilation and cargo test — full output in the IDE terminal.',
  },
  {
    icon: Rocket,
    step: '04',
    title: 'Deploy to Stellar',
    description: 'Generate a wallet in-browser, fund via Friendbot, and deploy to Testnet or Mainnet in one click.',
  },
  {
    icon: Users,
    step: '05',
    title: 'Collaborate & Push',
    description: 'Invite teammates for live editing, then push changes back to GitHub with a commit message.',
  },
]

export default function WorkflowSection() {
  return (
    <section id="workflow" className="py-24 border-t border-stellar-border bg-stellar-surface/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-sm font-semibold text-stellar-accent tracking-widest uppercase">
            Workflow
          </span>
          <h2 className="mt-3 text-4xl lg:text-5xl font-black text-stellar-heading tracking-tight">
            From idea to deployed contract in minutes
          </h2>
          <p className="mt-4 text-lg text-stellar-muted">
            StellarIDE removes every friction point between writing Soroban contracts and getting them live on Stellar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {steps.map((s, idx) => {
            const Icon = s.icon
            return (
              <div key={s.step} className="relative">
                {/* Connector line */}
                {idx < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-10 left-full w-full h-px bg-gradient-to-r from-stellar-accent/30 to-transparent z-0" />
                )}
                <div className="relative z-10 bg-stellar-card border border-stellar-border rounded-xl p-6 hover:border-stellar-accent/40 transition-all duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-stellar-accent/10 border border-stellar-accent/20 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-stellar-accent" />
                    </div>
                    <span className="text-3xl font-black text-stellar-border">{s.step}</span>
                  </div>
                  <h3 className="font-bold text-stellar-heading mb-2">{s.title}</h3>
                  <p className="text-sm text-stellar-muted leading-relaxed">{s.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
