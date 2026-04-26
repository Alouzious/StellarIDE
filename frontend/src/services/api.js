import axios from 'axios'

const normalizeApiBase = (base) => {
  const trimmed = (base || '').trim()
  if (!trimmed || trimmed === '/api' || trimmed === '/api/') return ''
  return trimmed.replace(/\/+$/, '').replace(/\/api\/v1$/i, '')
}

export const getApiBaseUrl = () => normalizeApiBase(import.meta.env.VITE_API_URL || 'http://localhost:8080')

const api = axios.create({
  baseURL: `${getApiBaseUrl()}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Response interceptor for global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired - clear auth state
      localStorage.removeItem('stellar-auth')
      delete api.defaults.headers.common['Authorization']
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
