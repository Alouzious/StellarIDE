import { create } from 'zustand'
import api from '../../services/api'

const useCollabStore = create((set, get) => ({
  role: 'owner',
  presence: [],
  fileConnectionStatus: 'idle',
  projectConnectionStatus: 'idle',
  deployLock: null,

  fetchRole: async (projectId) => {
    try {
      const { data } = await api.get(`/projects/${projectId}/collaborators/me`)
      set({ role: data.role || 'none' })
      return data.role
    } catch {
      set({ role: 'none' })
      return 'none'
    }
  },

  setRole: (role) => set({ role }),

  setPresence: (users) => set({ presence: users || [] }),

  setFileConnectionStatus: (fileConnectionStatus) => set({ fileConnectionStatus }),

  setProjectConnectionStatus: (projectConnectionStatus) =>
    set({ projectConnectionStatus }),

  setDeployLock: (deployLock) => set({ deployLock }),

  /** Unified status: red/disconnected if either socket is down. */
  unifiedConnectionStatus: () => {
    const { fileConnectionStatus, projectConnectionStatus } = get()
    const statuses = [fileConnectionStatus, projectConnectionStatus]
    if (statuses.some((s) => s === 'disconnected' || s === 'error')) return 'disconnected'
    if (statuses.some((s) => s === 'reconnecting' || s === 'connecting')) return 'reconnecting'
    if (statuses.every((s) => s === 'connected')) return 'connected'
    return 'idle'
  },

  isReadOnly: () => get().role === 'viewer',

  isOwner: () => get().role === 'owner',

  createInvite: async (projectId, role = 'editor') => {
    try {
      const { data } = await api.post(`/projects/${projectId}/collaborators/invite`, { role })
      return { success: true, ...data }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Failed to create invite' }
    }
  },

  joinInvite: async (projectId, token) => {
    try {
      const { data } = await api.post(
        `/projects/${projectId}/collaborators/join?token=${encodeURIComponent(token)}`
      )
      set({ role: data.role })
      return { success: true, role: data.role }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Failed to join project' }
    }
  },

  listCollaborators: async (projectId) => {
    try {
      const { data } = await api.get(`/projects/${projectId}/collaborators`)
      return { success: true, collaborators: data }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Failed to load collaborators' }
    }
  },

  reset: () =>
    set({
      presence: [],
      fileConnectionStatus: 'idle',
      projectConnectionStatus: 'idle',
      deployLock: null,
    }),
}))

export default useCollabStore
