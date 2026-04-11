import { create } from 'zustand'

const useAppStore = create((set) => ({
  user: null,
  isDark: (() => {
    const dark = localStorage.getItem('isDark') === 'true'
    document.documentElement.classList.toggle('dark', dark)
    return dark
  })(),
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
