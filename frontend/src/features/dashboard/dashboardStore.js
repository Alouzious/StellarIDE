import { create } from 'zustand'
import api from '../../services/api'

const useDashboardStore = create((set) => ({
  projects: [],
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get('/projects')
      set({ projects: data, loading: false })
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to load projects', loading: false })
    }
  },

  createProject: async (name, description) => {
    try {
      const { data } = await api.post('/projects', { name, description })
      set((state) => ({ projects: [data, ...state.projects] }))
      return { success: true, project: data }
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to create project'
      return { success: false, error: message }
    }
  },

  updateProject: async (id, updates) => {
    try {
      const { data } = await api.put(`/projects/${id}`, updates)
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? data : p)),
      }))
      return { success: true }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Update failed' }
    }
  },

  deleteProject: async (id) => {
    try {
      await api.delete(`/projects/${id}`)
      set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }))
      return { success: true }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Delete failed' }
    }
  },
}))

export default useDashboardStore
