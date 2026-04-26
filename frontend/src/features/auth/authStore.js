import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../../services/api'

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      loading: false,
      error: null,

      login: async (email, password) => {
        set({ loading: true, error: null })
        try {
          const { data } = await api.post('/auth/login', { email, password })
          set({ user: data.user, token: data.token, loading: false })
          api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`
          return { success: true }
        } catch (err) {
          const message = err.response?.data?.error || 'Login failed'
          set({ error: message, loading: false })
          return { success: false, error: message }
        }
      },

      register: async (email, password) => {
        set({ loading: true, error: null })
        try {
          const { data } = await api.post('/auth/register', { email, password })
          set({ user: data.user, token: data.token, loading: false })
          api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`
          return { success: true }
        } catch (err) {
          const message = err.response?.data?.error || 'Registration failed'
          set({ error: message, loading: false })
          return { success: false, error: message }
        }
      },

      // Called after OAuth provider redirects back with a JWT token
      loginWithToken: async (token) => {
        set({ loading: true, error: null })
        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          const { data } = await api.get('/auth/me')
          set({ user: data, token, loading: false })
          return { success: true }
        } catch (err) {
          delete api.defaults.headers.common['Authorization']
          const message = err.response?.data?.error || 'Authentication failed'
          set({ error: message, loading: false })
          return { success: false, error: message }
        }
      },

      logout: () => {
        set({ user: null, token: null, error: null })
        delete api.defaults.headers.common['Authorization']
      },

      setToken: (token) => {
        set({ token })
        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        } else {
          delete api.defaults.headers.common['Authorization']
        }
      },
    }),
    {
      name: 'stellar-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`
        }
      },
    }
  )
)

export default useAuthStore
