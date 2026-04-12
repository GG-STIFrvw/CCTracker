import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import useAppStore from '../../store/useAppStore.js'
import Button from '../ui/Button.jsx'
import { SunIcon, MoonIcon, OwlIcon } from '../ui/icons.jsx'
import { usePendingInvites } from '../../hooks/useShares.js'
import { usePendingBorrowerInvites } from '../../hooks/useBorrowerShares.js'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isDark, toggleDark } = useAppStore()
  const { data: pendingInvites = [] } = usePendingInvites()
  const { data: pendingBorrowerInvites = [] } = usePendingBorrowerInvites()

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  return (
    <nav className="sticky top-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 mr-auto"
        aria-label="Go to dashboard"
      >
        <OwlIcon className="w-7 h-7" />
        <span className="text-gray-900 dark:text-white font-bold hidden sm:inline tracking-tight">
          OWL <span className="text-[#9FE870]">Tracker</span>
        </span>
      </button>

      {user && (
        <span className="text-gray-500 dark:text-gray-500 text-sm hidden md:block truncate max-w-[200px]">
          {user.email}
        </span>
      )}

      {/* Shared with me link */}
      {user && (
        <button
          onClick={() => navigate('/shared')}
          className={`relative text-sm px-3 py-1.5 rounded-lg transition-colors ${
            location.pathname === '/shared'
              ? 'bg-[#9FE870]/20 text-[#2D6A4F] dark:text-[#9FE870] font-semibold'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          Shared
          {pendingInvites.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center leading-none">
              {pendingInvites.length}
            </span>
          )}
        </button>
      )}

      {/* Shared Borrowers link */}
      {user && (
        <button
          onClick={() => navigate('/shared-borrowers')}
          className={`relative text-sm px-3 py-1.5 rounded-lg transition-colors ${
            location.pathname === '/shared-borrowers'
              ? 'bg-[#9FE870]/20 text-[#2D6A4F] dark:text-[#9FE870] font-semibold'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          Borrowers
          {pendingBorrowerInvites.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center leading-none">
              {pendingBorrowerInvites.length}
            </span>
          )}
        </button>
      )}

      <button
        onClick={toggleDark}
        className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-base"
        title="Toggle theme"
        aria-label="Toggle dark mode"
      >
        {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
      </button>

      <Button variant="ghost" onClick={signOut} className="text-sm">
        Sign Out
      </Button>
    </nav>
  )
}
