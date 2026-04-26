import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, CheckCircle } from 'lucide-react'
import useAuthStore from '../features/auth/authStore'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { getApiBaseUrl } from '../services/api'

const API_URL = getApiBaseUrl()

function GitHubIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function PasswordStrength({ password }) {
  const checks = [
    { label: '8+ characters', pass: password.length >= 8 },
    { label: 'Uppercase letter', pass: /[A-Z]/.test(password) },
    { label: 'Number', pass: /[0-9]/.test(password) },
    { label: 'Special character', pass: /[^A-Za-z0-9]/.test(password) },
  ]
  const score = checks.filter((c) => c.pass).length
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500']
  const labels = ['Weak', 'Fair', 'Good', 'Strong']

  if (!password) return null

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < score ? colors[score - 1] : 'bg-stellar-border'}`}
          />
        ))}
      </div>
      <p className="text-xs text-stellar-muted">
        Strength: <span className={score >= 3 ? 'text-green-400' : score >= 2 ? 'text-yellow-400' : 'text-red-400'}>{labels[score - 1] || 'Very Weak'}</span>
      </p>
      <div className="grid grid-cols-2 gap-1">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-1.5">
            <CheckCircle className={`w-3 h-3 ${c.pass ? 'text-green-400' : 'text-stellar-border'}`} />
            <span className={`text-xs ${c.pass ? 'text-stellar-muted' : 'text-stellar-border'}`}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register, loading } = useAuthStore()

  const [form, setForm] = useState({ email: '', password: '', confirm: '', terms: false })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')

  const validate = () => {
    const e = {}
    if (!form.email) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email'
    if (!form.password) e.password = 'Password is required'
    else if (form.password.length < 8) e.password = 'Password must be at least 8 characters'
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match'
    if (!form.terms) e.terms = 'You must accept the terms'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError('')
    if (!validate()) return
    const result = await register(form.email, form.password)
    if (result.success) {
      navigate('/dashboard')
    } else {
      setServerError(result.error)
    }
  }

  const handleOAuth = (provider) => {
    window.location.href = `${API_URL}/api/v1/auth/${provider}`
  }

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <Link to="/" className="inline-flex items-center gap-2 mb-6">
          <img src="/logo.png" alt="StellarIDE" className="w-10 h-10 object-contain rounded-xl" />
          <span className="text-xl font-bold text-stellar-heading">
            Stellar<span className="text-stellar-accent">IDE</span>
          </span>
        </Link>
        <h1 className="text-2xl font-bold text-stellar-heading">Create your account</h1>
        <p className="mt-1 text-sm text-stellar-muted">Start building Soroban contracts today — free</p>
      </div>

      <div className="card">
        {/* OAuth buttons */}
        <div className="space-y-2 mb-5">
          <button
            type="button"
            onClick={() => handleOAuth('github')}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-stellar-surface border border-stellar-border hover:border-stellar-accent/40 hover:bg-stellar-card text-stellar-text rounded-lg text-sm font-medium transition-all"
          >
            <GitHubIcon />
            Continue with GitHub
          </button>
          <button
            type="button"
            onClick={() => handleOAuth('google')}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-stellar-surface border border-stellar-border hover:border-stellar-accent/40 hover:bg-stellar-card text-stellar-text rounded-lg text-sm font-medium transition-all"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        <div className="relative flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-stellar-border" />
          <span className="text-xs text-stellar-border">or register with email</span>
          <div className="flex-1 h-px bg-stellar-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {serverError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {serverError}
            </div>
          )}

          <Input
            label="Email address"
            type="email"
            icon={Mail}
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            error={errors.email}
            autoComplete="email"
          />

          <div>
            <Input
              label="Password"
              type="password"
              icon={Lock}
              placeholder="Create a strong password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              error={errors.password}
              autoComplete="new-password"
            />
            <PasswordStrength password={form.password} />
          </div>

          <Input
            label="Confirm password"
            type="password"
            icon={Lock}
            placeholder="Repeat your password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            error={errors.confirm}
            autoComplete="new-password"
          />

          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-stellar-border bg-stellar-surface text-stellar-accent focus:ring-stellar-accent"
                checked={form.terms}
                onChange={(e) => setForm({ ...form, terms: e.target.checked })}
              />
              <span className="text-sm text-stellar-muted">
                I agree to the{' '}
                <a href="#" className="text-stellar-accent hover:underline">Terms of Service</a>
                {' '}and{' '}
                <a href="#" className="text-stellar-accent hover:underline">Privacy Policy</a>
              </span>
            </label>
            {errors.terms && <p className="mt-1.5 text-xs text-red-400">{errors.terms}</p>}
          </div>

          <Button type="submit" className="w-full justify-center" loading={loading}>
            Create Account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-stellar-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-stellar-accent hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
