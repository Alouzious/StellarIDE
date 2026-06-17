import { create } from 'zustand'
import api, { getApiBaseUrl } from '../../services/api'

const useGitHubStore = create((set, get) => ({
  status: null,
  repos: [],
  loading: false,
  importing: false,
  linking: false,
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

  fetchRepoFolders: async (owner, repo, branch) => {
    try {
      const params = branch ? { branch } : {}
      const { data } = await api.get(`/github/repos/${owner}/${repo}/folders`, { params })
      return {
        success: true,
        branch: data.branch,
        isFlat: data.is_flat,
        hasRootCargo: data.has_root_cargo,
        folders: data.folders || [],
      }
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to load repository folders'
      return { success: false, error: message }
    }
  },

  importRepo: async (owner, repo, branch, projectName, subfolder) => {
    set({ importing: true, error: null })
    try {
      const { data } = await api.post('/github/import', {
        owner,
        repo,
        branch: branch || undefined,
        project_name: projectName || undefined,
        subfolder: subfolder || undefined,
      })
      set({ importing: false })
      return { success: true, project: data.project, filesImported: data.files_imported }
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to import repository'
      set({ importing: false, error: message })
      return { success: false, error: message }
    }
  },

  linkProjectRepo: async (projectId, repoUrl, branch, subfolder) => {
    set({ linking: true, error: null })
    try {
      const { data } = await api.post(`/projects/${projectId}/github/link`, {
        repo_url: repoUrl,
        branch: branch || undefined,
        subfolder: subfolder || undefined,
      })
      set({ linking: false })
      return { success: true, project: data.project }
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to link GitHub repository'
      set({ linking: false, error: message })
      return { success: false, error: message }
    }
  },
}))

export default useGitHubStore
