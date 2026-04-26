import { Link } from 'react-router-dom'
import { Zap, ArrowRight } from 'lucide-react'
import Button from '../../components/ui/Button'

export default function CtaSection() {
  return (
    <section className="py-24 border-t border-stellar-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-stellar-accent/20 via-stellar-surface to-indigo-900/20 border border-stellar-accent/30 p-16 text-center">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-20 -left-20 w-80 h-80 bg-stellar-accent/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-4xl lg:text-6xl font-black text-stellar-heading mb-6 tracking-tight">
              Ready to build on Stellar?
            </h2>
            <p className="text-xl text-stellar-muted max-w-2xl mx-auto mb-10">
              Join hundreds of developers writing Soroban smart contracts in StellarIDE.
              Free forever for open-source projects.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register">
                <Button size="lg" className="shadow-xl shadow-stellar-accent/20">
                  <Zap className="w-5 h-5" />
                  Start Building Free
                </Button>
              </Link>
              <a href="https://docs.stellar.org/docs/smart-contracts" target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="lg">
                  Read the Docs
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </a>
            </div>
            <p className="mt-8 text-sm text-stellar-muted">
              No credit card required &nbsp;·&nbsp; Free Testnet tier &nbsp;·&nbsp; Open source
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
