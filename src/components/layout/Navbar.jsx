import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import useAppStore from '../../store/useAppStore.js'
import Button from '../ui/Button.jsx'

export default function Navbar() {
  const navigate = useNavigate()
  const { user, isDark, toggleDark } = useAppStore()

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  return (
    <nav className="sticky top-0 z-40 bg-gray-900/90 backdrop-blur border-b border-gray-700 px-4 py-3 flex items-center gap-3">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 mr-auto"
        aria-label="Go to dashboard"
      >
        <span className="bg-blue-600 text-white font-bold px-3 py-1 rounded-lg text-sm tracking-tight">
          CC
        </span>
        <span className="text-white font-semibold hidden sm:inline">Tracker</span>
      </button>

      {user && (
        <span className="text-gray-500 text-sm hidden md:block truncate max-w-[200px]">
          {user.email}
        </span>
      )}

      <button
        onClick={toggleDark}
        className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-700 transition-colors text-base"
        title="Toggle theme"
        aria-label="Toggle dark mode"
      >
        {isDark ? '☀️' : '🌙'}
      </button>

      <Button variant="ghost" onClick={signOut} className="text-sm">
        Sign Out
      </Button>
    </nav>
  )
}
