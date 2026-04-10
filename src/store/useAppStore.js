import { create } from 'zustand'

const useAppStore = create((set) => ({
  user: null,
  isDark: true,
  setUser: (user) => set({ user }),
  toggleDark: () =>
    set((s) => {
      const next = !s.isDark
      document.documentElement.classList.toggle('dark', next)
      return { isDark: next }
    }),
}))

export default useAppStore
