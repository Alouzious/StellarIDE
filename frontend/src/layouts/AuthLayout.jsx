import { Navigate, Outlet } from 'react-router-dom'
import useAuthStore from '../features/auth/authStore'

export default function AuthLayout() {
  const { user } = useAuthStore()

  if (user) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-stellar-bg">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-stellar-accent/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-700/5 rounded-full blur-3xl" />
      </div>
      <div className="relative w-full max-w-md">
        <Outlet />
      </div>
    </div>
  )
}
