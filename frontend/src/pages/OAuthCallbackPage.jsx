import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Code2, Loader2, XCircle } from 'lucide-react'
import useAuthStore from '../features/auth/authStore'

function getInitialError(searchParams) {
  const oauthError = searchParams.get('error')
  if (oauthError) return `Authentication failed: ${oauthError}`
  const token = searchParams.get('token')
  if (!token) return 'No authentication token received. Please try again.'
  return ''
}

export default function OAuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { loginWithToken } = useAuthStore()
  const [error, setError] = useState(() => getInitialError(searchParams))

  useEffect(() => {
    // If there was an initial error, do nothing — already shown
    if (error) return

    const token = searchParams.get('token')
    if (!token) return

    loginWithToken(token).then((result) => {
      if (result.success) {
        navigate('/dashboard', { replace: true })
      } else {
        setError(result.error || 'Authentication failed. Please try again.')
      }
    })
  // Run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-stellar-bg">
      <div className="text-center space-y-6 max-w-sm w-full px-4">
        <Link to="/" className="inline-flex items-center gap-2 justify-center">
          <div className="w-10 h-10 rounded-xl bg-stellar-accent/20 border border-stellar-accent/30 flex items-center justify-center">
            <Code2 className="w-5 h-5 text-stellar-accent" />
          </div>
          <span className="text-xl font-bold text-stellar-heading">
            Stellar<span className="text-stellar-accent">IDE</span>
          </span>
        </Link>

        {error ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 mx-auto">
              <XCircle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="font-semibold text-stellar-heading">Sign-in failed</p>
              <p className="text-sm text-stellar-muted mt-1">{error}</p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-4 py-2 bg-stellar-accent hover:bg-stellar-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
            >
              Back to Sign In
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <Loader2 className="w-8 h-8 text-stellar-accent animate-spin mx-auto" />
            <p className="text-stellar-muted text-sm">Completing sign-in…</p>
          </div>
        )}
      </div>
    </div>
  )
}
