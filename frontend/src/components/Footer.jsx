import { Link } from 'react-router-dom'
import { Code2, ExternalLink, Globe } from 'lucide-react'

export default function Footer() {
  const year = new Date().getFullYear()

  const cols = [
    {
      title: 'Product',
      links: [
        { label: 'Features', href: '/#features' },
        { label: 'How it Works', href: '/#workflow' },
        { label: 'IDE Preview', href: '/#preview' },
      ],
    },
    {
      title: 'Developers',
      links: [
        { label: 'Documentation', href: '#' },
        { label: 'API Reference', href: '#' },
        { label: 'Changelog', href: '#' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', href: '#' },
        { label: 'Privacy Policy', href: '#' },
        { label: 'Terms of Service', href: '#' },
      ],
    },
  ]

  return (
    <footer className="border-t border-stellar-border bg-stellar-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-stellar-accent/20 border border-stellar-accent/30 flex items-center justify-center">
                <Code2 className="w-4 h-4 text-stellar-accent" />
              </div>
              <span className="text-lg font-bold text-stellar-heading">
                Stellar<span className="text-stellar-accent">IDE</span>
              </span>
            </Link>
            <p className="text-sm text-stellar-muted leading-relaxed">
              The premium browser-based IDE for Soroban smart contract development on Stellar.
            </p>
            <div className="flex gap-3">
              {[
                { Icon: ExternalLink, href: 'https://github.com', label: 'GitHub' },
                { Icon: Globe, href: '#', label: 'Website' },
                { Icon: ExternalLink, href: '#', label: 'Twitter' },
              ].map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-md bg-stellar-card border border-stellar-border flex items-center justify-center text-stellar-muted hover:text-white hover:border-stellar-accent/50 transition-all"
                >
                  <Icon className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-stellar-heading mb-4">{col.title}</h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-stellar-muted hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-stellar-border flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-stellar-muted">
            &copy; {year} StellarIDE. All rights reserved.
          </p>
          <p className="text-sm text-stellar-muted">
            Built for the{' '}
            <a
              href="https://stellar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stellar-accent hover:underline"
            >
              Stellar
            </a>{' '}
            ecosystem.
          </p>
        </div>
      </div>
    </footer>
  )
}
