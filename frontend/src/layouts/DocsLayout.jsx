import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Menu, X, BookOpen } from 'lucide-react'
import { GUIDE_NAV, TECH_NAV } from '../docs/navigation'

function NavSection({ title, items, onNavigate }) {
  return (
    <div className="mb-6">
      <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-stellar-border">
        {title}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/docs' || item.path === '/docs/guide'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-stellar-accent/15 text-stellar-accent border border-stellar-accent/20'
                  : 'text-stellar-muted hover:text-white hover:bg-stellar-card'
              }`
            }
          >
            {item.title}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

export default function DocsLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="min-h-screen bg-stellar-bg text-stellar-text flex flex-col">
      <header className="sticky top-0 z-40 border-b border-stellar-border bg-stellar-bg/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="lg:hidden p-2 text-stellar-muted hover:text-white"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Toggle docs navigation"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link to="/" className="flex items-center gap-2 min-w-0">
              <img src="/logo.png" alt="StellarIDE" className="w-7 h-7 rounded-md" />
              <span className="font-bold text-stellar-heading truncate">
                Stellar<span className="text-stellar-accent">IDE</span>
                <span className="text-stellar-muted font-normal ml-2 hidden sm:inline">Docs</span>
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/docs/guide" className="hidden sm:inline text-xs text-stellar-muted hover:text-white px-3 py-1.5">
              User Guide
            </Link>
            <Link to="/register" className="text-xs font-semibold px-3 py-1.5 rounded-md bg-stellar-accent hover:bg-stellar-accent-hover text-white transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex gap-8">
        <aside className={`${sidebarOpen ? 'block' : 'hidden'} lg:block w-64 flex-shrink-0`}>
          <nav className="sticky top-20">
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-stellar-border flex items-center gap-1.5">
              <BookOpen className="w-3 h-3" />
              Documentation
            </p>
            <NavSection title="User Guide" items={GUIDE_NAV} onNavigate={closeSidebar} />
            <NavSection title="Technical Reference" items={TECH_NAV} onNavigate={closeSidebar} />
          </nav>
        </aside>

        <main className="flex-1 min-w-0 pb-16">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
