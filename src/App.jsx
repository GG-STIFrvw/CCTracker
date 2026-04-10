import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from './lib/supabase.js'
import useAppStore from './store/useAppStore.js'
import AuthPage from './pages/AuthPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import TrackerPage from './pages/TrackerPage.jsx'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 30 } },
})

function ProtectedRoute({ children }) {
  const user = useAppStore((s) => s.user)
  if (!user) return <Navigate to="/auth" replace />
  return children
}

export default function App() {
  const setUser = useAppStore((s) => s.setUser)

  useEffect(() => {
    // Load existing session on mount
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))

    // Keep user state in sync with Supabase auth events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      queryClient.clear() // clear cached data on auth change
    })

    return () => subscription.unsubscribe()
  }, [setUser])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tracker/:cardId"
            element={
              <ProtectedRoute>
                <TrackerPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
