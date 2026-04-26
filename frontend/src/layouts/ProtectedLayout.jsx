import { Navigate, Outlet } from 'react-router-dom'
import useAuthStore from '../features/auth/authStore'

export default function ProtectedLayout() {
  const { user } = useAuthStore()

  if (!user) return <Navigate to="/" replace />

  return <Outlet />
}
