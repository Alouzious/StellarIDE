import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, X, Zap, GithubIcon, MessageSquare } from 'lucide-react'
import useAuthStore from '../features/auth/authStore'
import Button from './ui/Button'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const navLinks = [
    { label: 'Features', href: '/#features' },
    { label: 'How it Works', href: '/#workflow' },
    { label: 'Resources', href: '/#resources' },
  ]

  const contributeUrl = 'https://github.com/Alouzious/StellarIDE'

  const feedbackUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSfIFHRHnKjBzwwTtKZ5DjeIjPJLYHRqDgK2EVmJCy4evd2-og/viewform?usp=publish-editor'

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-stellar-border/50 bg-stellar-bg/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img src="/logo.png" alt="StellarIDE" className="w-8 h-8 object-contain rounded-lg" />
            <span className="text-lg font-bold text-stellar-heading">
              Stellar<span className="text-stellar-accent">IDE</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href}
                className="px-4 py-2 text-sm text-stellar-muted hover:text-white rounded-md hover:bg-stellar-card transition-all duration-150">
                {link.label}
              </a>
            ))}

            <a href={contributeUrl} target="_blank" rel="noopener noreferrer"
              className="px-4 py-2 text-sm text-stellar-muted hover:text-white rounded-md hover:bg-stellar-card transition-all duration-150 flex items-center gap-1.5">
              <GithubIcon className="w-4 h-4" />
              Contribute
            </a>

            <a href={feedbackUrl} target="_blank" rel="noopener noreferrer"
              className="px-4 py-2 text-sm text-stellar-muted hover:text-white rounded-md hover:bg-stellar-card transition-all duration-150 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" />
              Give Feedback
            </a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <Link to="/dashboard">
                  <Button variant="secondary" size="sm">Dashboard</Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout}>Sign Out</Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="sm">
                    <Zap className="w-3.5 h-3.5" />
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>

          <button className="md:hidden text-stellar-muted hover:text-white p-2 rounded-md"
            onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {open && (
          <div className="md:hidden py-4 border-t border-stellar-border/50 flex flex-col gap-2">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href}
                className="px-4 py-2 text-sm text-stellar-muted hover:text-white rounded-md hover:bg-stellar-card transition-all"
                onClick={() => setOpen(false)}>
                {link.label}
              </a>
            ))}

            <a href={contributeUrl} target="_blank" rel="noopener noreferrer"
              className="px-4 py-2 text-sm text-stellar-muted hover:text-white rounded-md hover:bg-stellar-card transition-all flex items-center gap-2"
              onClick={() => setOpen(false)}>
              <GithubIcon className="w-4 h-4" />
              Contribute
            </a>

            <a href={feedbackUrl} target="_blank" rel="noopener noreferrer"
              className="px-4 py-2 text-sm text-stellar-muted hover:text-white rounded-md hover:bg-stellar-card transition-all flex items-center gap-2"
              onClick={() => setOpen(false)}>
              <MessageSquare className="w-4 h-4" />
              Give Feedback
            </a>

            <div className="flex flex-col gap-2 pt-2 border-t border-stellar-border/50">
              {user ? (
                <>
                  <Link to="/dashboard" onClick={() => setOpen(false)}>
                    <Button variant="secondary" size="sm" className="w-full justify-center">
                      Dashboard
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm"
                    onClick={() => { handleLogout(); setOpen(false) }}
                    className="justify-center">
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setOpen(false)}>
                    <Button variant="ghost" size="sm" className="w-full justify-center">
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/register" onClick={() => setOpen(false)}>
                    <Button variant="primary" size="sm" className="w-full justify-center">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}