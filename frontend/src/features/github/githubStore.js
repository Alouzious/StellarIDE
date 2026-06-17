import { create } from 'zustand'
import api, { getApiBaseUrl } from '../../services/api'

const useGitHubStore = create((set, get) => ({
  status: null, // { connected, github_login, scopes }
  repos: [],
  loading: false,
  importing: false,
  error: null,

  fetchStatus: async () => {
    try {
      const { data } = await api.get('/github/status')
      set({ status: data, error: null })
      return data
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to check GitHub status' })
      return null
    }
  },

  connectGitHub: async () => {
    try {
      const { data } = await api.get('/github/connect-url')
      if (data?.url) {
        window.location.href = data.url
        return { success: true }
      }
      return { success: false, error: 'No connect URL returned' }
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to start GitHub connect'
      return { success: false, error: message }
    }
  },

  startGitHubLogin: () => {
    window.location.href = `${getApiBaseUrl()}/api/v1/auth/github`
  },

  fetchRepos: async () => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get('/github/repos')
      set({ repos: data.repos || [], loading: false })
      return { success: true, repos: data.repos || [] }
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to load repositories'
      set({ loading: false, error: message })
      return { success: false, error: message }
    }
  },

  importRepo: async (owner, repo, branch, projectName) => {
    set({ importing: true, error: null })
    try {
      const { data } = await api.post('/github/import', {
        owner,
        repo,
        branch: branch || undefined,
        project_name: projectName || undefined,
      })
      set({ importing: false })
      return { success: true, project: data.project, filesImported: data.files_imported }
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to import repository'
      set({ importing: false, error: message })
      return { success: false, error: message }
    }
  },
}))

export default useGitHubStore
