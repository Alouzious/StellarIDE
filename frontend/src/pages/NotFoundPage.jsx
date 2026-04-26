import { Link } from 'react-router-dom'
import { Code2, Home, ArrowLeft } from 'lucide-react'
import Button from '../components/ui/Button'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 bg-stellar-bg">
      <div className="w-16 h-16 rounded-2xl bg-stellar-accent/10 border border-stellar-accent/30 flex items-center justify-center mb-6">
        <Code2 className="w-8 h-8 text-stellar-accent" />
      </div>
      <p className="text-8xl font-black text-stellar-border mb-4">404</p>
      <h1 className="text-3xl font-bold text-stellar-heading mb-3">Page not found</h1>
      <p className="text-stellar-muted mb-8 max-w-sm">
        This page doesn&apos;t exist — maybe you wandered off the Stellar network.
      </p>
      <div className="flex gap-3">
        <Link to="/">
          <Button>
            <Home className="w-4 h-4" />
            Go Home
          </Button>
        </Link>
        <button onClick={() => window.history.back()}>
          <Button variant="secondary">
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
        </button>
      </div>
    </div>
  )
}
