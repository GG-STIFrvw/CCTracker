import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import useAppStore from '../../store/useAppStore.js'
import Button from '../ui/Button.jsx'
import { SunIcon, MoonIcon, OwlIcon, ExpensesIcon, HomeIcon, UsersIcon, ShareIcon } from '../ui/icons.jsx'
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

  const navLinks = [
    { path: '/', label: 'Dashboard', Icon: HomeIcon, badge: 0 },
    { path: '/shared', label: 'Shared', Icon: ShareIcon, badge: pendingInvites.length },
    { path: '/shared-borrowers', label: 'Borrowers', Icon: UsersIcon, badge: pendingBorrowerInvites.length },
    { path: '/expenses', label: 'Expenses', Icon: ExpensesIcon, badge: 0 },
  ]

  function isActive(path) {
    if (path === '/') return location.pathname === '/'
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <>
      {/* ── Desktop navbar (md and up) ─────────────────────────────── */}
      <nav className="hidden md:flex sticky top-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-700 px-4 py-3 items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 mr-auto"
          aria-label="Go to dashboard"
        >
          <OwlIcon className="w-7 h-7 text-gray-900 dark:text-white" />
          <span className="text-gray-900 dark:text-white font-bold tracking-tight">
            CC <span className="text-[#9FE870]">Tracker</span>
          </span>
        </button>

        {user && (
          <span className="text-gray-500 dark:text-gray-500 text-sm truncate max-w-[200px]">
            {user.email}
          </span>
        )}

        {user && navLinks.map(({ path, label, badge }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`relative text-sm px-3 py-1.5 rounded-lg transition-colors ${
              isActive(path)
                ? 'bg-[#9FE870]/20 text-[#2D6A4F] dark:text-[#9FE870] font-semibold'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {label}
            {badge > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center leading-none">
                {badge}
              </span>
            )}
          </button>
        ))}

        <button
          onClick={toggleDark}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Toggle theme"
          aria-label="Toggle dark mode"
        >
          {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>

        <Button variant="ghost" onClick={signOut} className="text-sm">
          Sign Out
        </Button>
      </nav>

      {/* ── Mobile top bar (below md) ──────────────────────────────── */}
      <nav className="md:hidden sticky top-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2"
          aria-label="Go to dashboard"
        >
          <OwlIcon className="w-7 h-7 text-gray-900 dark:text-white" />
          <span className="text-gray-900 dark:text-white font-bold tracking-tight">
            CC <span className="text-[#9FE870]">Tracker</span>
          </span>
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleDark}
            className="text-gray-500 dark:text-gray-400 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle dark mode"
          >
            {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </button>
          {user && (
            <Button variant="ghost" onClick={signOut} className="text-sm">
              Sign Out
            </Button>
          )}
        </div>
      </nav>

      {/* ── Mobile bottom nav (below md) ──────────────────────────── */}
      {user && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex items-stretch">
            {navLinks.map(({ path, label, Icon, badge }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
                  isActive(path)
                    ? 'text-[#2D6A4F] dark:text-[#9FE870]'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center leading-none">
                      {badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </>
  )
}
