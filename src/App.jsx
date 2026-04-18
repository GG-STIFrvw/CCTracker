import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from './lib/supabase.js'
import useAppStore from './store/useAppStore.js'
import AuthPage from './pages/AuthPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import TrackerPage from './pages/TrackerPage.jsx'
import SharedWithMePage from './pages/SharedWithMePage.jsx'
import LoanPage from './pages/LoanPage.jsx'
import SharedBorrowersPage from './pages/SharedBorrowersPage.jsx'
import ExpensesPage from './pages/ExpensesPage.jsx'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 30 } },
})

function ProtectedRoute({ children }) {
  const user = useAppStore((s) => s.user)
  if (!user) return <Navigate to="/auth" replace />
  return <div className="pb-16 md:pb-0">{children}</div>
}

export default function App() {
  const setUser = useAppStore((s) => s.setUser)
  const [sessionLoaded, setSessionLoaded] = useState(false)

  useEffect(() => {
    // OAuth implicit flow lands here with tokens in the URL hash.
    // We must keep the spinner up (no BrowserRouter) so React Router
    // cannot navigate away and wipe the hash before Supabase reads it.
    // Once Supabase fires, we hard-redirect to / so the app reloads
    // cleanly with the session already persisted to localStorage.
    if (window.location.hash.includes('access_token=')) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          window.location.replace('/')
        }
      })

      // Safety fallback: if the event takes > 3 s, redirect anyway
      const timer = setTimeout(() => {
        window.location.replace(
          window.location.hash.includes('error') ? '/auth' : '/'
        )
      }, 3000)

      return () => {
        subscription.unsubscribe()
        clearTimeout(timer)
      }
    }

    // ── Normal page load (no OAuth hash) ──────────────────────────────
    // onAuthStateChange fires INITIAL_SESSION immediately on subscribe,
    // so we don't need a separate getSession() call. Using both caused a
    // race where queryClient.clear() wiped data right after sessionLoaded
    // was set, producing a white screen on hard refresh.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setSessionLoaded(true)
      if (event !== 'INITIAL_SESSION') {
        queryClient.clear()
      }
      if (session?.user) {
        supabase.rpc('claim_pending_shares')
          .then(() => queryClient.invalidateQueries({ queryKey: ['pending-invites'] }))
          .catch(() => {})
        supabase.rpc('claim_pending_borrower_shares')
          .then(() => queryClient.invalidateQueries({ queryKey: ['pending-borrower-invites'] }))
          .catch(() => {})
      }
    })

    return () => subscription.unsubscribe()
  }, [setUser])

  if (!sessionLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

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
          <Route
            path="/borrower/:borrowerId"
            element={
              <ProtectedRoute>
                <LoanPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shared"
            element={
              <ProtectedRoute>
                <SharedWithMePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shared-borrowers"
            element={
              <ProtectedRoute>
                <SharedBorrowersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <ProtectedRoute>
                <ExpensesPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
