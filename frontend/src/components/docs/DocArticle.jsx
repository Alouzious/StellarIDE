import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react'
import DocsMarkdown from './DocsMarkdown'
import { GITHUB_EDIT_BASE, getDocMeta } from '../../docs/navigation'

export default function DocArticle({ title, description, sections, editFile }) {
  const { pathname } = useLocation()
  const { prev, next } = getDocMeta(pathname)

  return (
    <article className="max-w-3xl">
      <nav className="text-xs text-stellar-muted mb-6 flex flex-wrap items-center gap-1">
        <Link to="/docs" className="hover:text-white transition-colors">Docs</Link>
        <span>/</span>
        <span className="text-stellar-text">{title}</span>
      </nav>

      <header className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-black text-stellar-heading tracking-tight mb-3">{title}</h1>
        {description && <p className="text-lg text-stellar-muted leading-relaxed">{description}</p>}
      </header>

      <div className="space-y-10">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <h2 className="text-xl font-bold text-stellar-heading mb-3 pb-2 border-b border-stellar-border">
              <a href={`#${section.id}`} className="hover:text-stellar-accent transition-colors">
                {section.title}
              </a>
            </h2>
            <DocsMarkdown>{section.body}</DocsMarkdown>
          </section>
        ))}
      </div>

      <div className="mt-12 pt-6 border-t border-stellar-border flex flex-col sm:flex-row gap-3 sm:justify-between">
        {prev ? (
          <Link to={prev.path} className="group flex items-center gap-2 text-sm text-stellar-muted hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>
              <span className="block text-[10px] uppercase tracking-wider text-stellar-border">Previous</span>
              {prev.title}
            </span>
          </Link>
        ) : <div />}
        {next ? (
          <Link to={next.path} className="group flex items-center gap-2 text-sm text-stellar-muted hover:text-white transition-colors sm:text-right sm:ml-auto">
            <span>
              <span className="block text-[10px] uppercase tracking-wider text-stellar-border">Next</span>
              {next.title}
            </span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ) : null}
      </div>

      {editFile && (
        <div className="mt-8 pt-6 border-t border-stellar-border">
          <a
            href={`${GITHUB_EDIT_BASE}/${editFile}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-stellar-muted hover:text-stellar-accent transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Edit this page on GitHub
          </a>
        </div>
      )}
    </article>
  )
}
