import { create } from 'zustand'
import api from '../../services/api'

const useCollabStore = create((set, get) => ({
  role: 'owner',
  presence: [],
  connectionStatus: 'idle',
  projectConnectionStatus: 'idle',

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

  addPresenceUser: (user) =>
    set((state) => {
      const filtered = state.presence.filter((u) => u.user_id !== user.user_id)
      return { presence: [...filtered, user] }
    }),

  removePresenceUser: (userId) =>
    set((state) => ({
      presence: state.presence.filter((u) => u.user_id !== userId),
    })),

  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  setProjectConnectionStatus: (projectConnectionStatus) =>
    set({ projectConnectionStatus }),

  isReadOnly: () => {
    const { role } = get()
    return role === 'viewer'
  },

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
      connectionStatus: 'idle',
      projectConnectionStatus: 'idle',
    }),
}))

export default useCollabStore
