import { create } from 'zustand'
import api from '../../services/api'

let _msgId = 0
const nextId = () => ++_msgId

const useChatStore = create((set, get) => ({
  messages: [],
  isLoading: false,
  error: null,
  isOpen: false,
  projectId: null,

  setProjectId: (projectId) => set({ projectId }),

  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
  openChat: () => set({ isOpen: true }),
  closeChat: () => set({ isOpen: false }),

  clearMessages: () => set({ messages: [], error: null }),

  sendMessage: async (content) => {
    const { messages, projectId } = get()

    const userMessage = { role: 'user', content, id: nextId() }
    set({ messages: [...messages, userMessage], isLoading: true, error: null })

    const chatMessages = [...messages, { role: 'user', content }].map(({ role, content: c }) => ({
      role,
      content: c,
    }))

    try {
      const endpoint = projectId ? `/projects/${projectId}/ai/chat` : '/ai/chat'
      const { data } = await api.post(endpoint, { messages: chatMessages })
      const assistantMessage = {
        role: 'assistant',
        content: data.message,
        id: nextId(),
      }
      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false,
      }))
    } catch (err) {
      const errorText =
        err.response?.data?.error ||
        'AI assistant is unavailable. Check that GROQ_API_KEY is configured.'
      set((state) => ({
        messages: [
          ...state.messages,
          {
            role: 'assistant',
            content: `⚠ ${errorText}`,
            id: nextId(),
            isError: true,
          },
        ],
        isLoading: false,
        error: errorText,
      }))
    }
  },
}))

export default useChatStore
