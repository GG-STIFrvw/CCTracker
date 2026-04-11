import { create } from 'zustand'

const useAppStore = create((set) => ({
  user: null,
  isDark: typeof localStorage !== 'undefined'
    ? localStorage.getItem('isDark') !== 'false'
    : true,
  setUser: (user) => set({ user }),
  toggleDark: () =>
    set((s) => {
      const next = !s.isDark
      document.documentElement.classList.toggle('dark', next)
      localStorage.setItem('isDark', String(next))
      return { isDark: next }
    }),
}))

export default useAppStore
