import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import useAppStore from '../store/useAppStore.js'
import Navbar from '../components/layout/Navbar.jsx'
import Button from '../components/ui/Button.jsx'
import { useToast, ToastContainer } from '../components/ui/Toast.jsx'

export default function ProfilePage() {
  const user = useAppStore((s) => s.user)
  const setUser = useAppStore((s) => s.setUser)

  const [displayName, setDisplayName] = useState(user?.user_metadata?.display_name ?? '')
  const [savingName, setSavingName] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const { toasts, toast } = useToast()

  async function handleSaveName(e) {
    e.preventDefault()
    setSavingName(true)
    const { data, error } = await supabase.auth.updateUser({
      data: { display_name: displayName.trim() },
    })
    setSavingName(false)
    if (error) {
      toast(error.message, 'error')
    } else {
      setUser(data.user)
      toast('Display name updated!', 'success')
    }
  }

  async function handleSavePassword(e) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast('Passwords do not match', 'error')
      return
    }
    if (newPassword.length < 6) {
      toast('Password must be at least 6 characters', 'error')
      return
    }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) {
      toast(error.message, 'error')
    } else {
      setNewPassword('')
      setConfirmPassword('')
      toast('Password updated!', 'success')
    }
  }

  const inputClass =
    'bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9FE870] focus:border-transparent transition-colors w-full'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <main className="max-w-lg mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Profile</h1>
        <p className="text-gray-500 text-sm mb-8">{user?.email}</p>

        {/* Display Name */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Display Name</h2>
          <form onSubmit={handleSaveName} className="flex flex-col gap-3">
            <input
              className={inputClass}
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <Button type="submit" disabled={savingName} className="self-start">
              {savingName ? 'Saving…' : 'Save Name'}
            </Button>
          </form>
        </section>

        {/* Change Password */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Change Password</h2>
          <form onSubmit={handleSavePassword} className="flex flex-col gap-3">
            <input
              className={inputClass}
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
            <input
              className={inputClass}
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            <Button type="submit" disabled={savingPassword} className="self-start">
              {savingPassword ? 'Saving…' : 'Update Password'}
            </Button>
          </form>
        </section>
      </main>
      <ToastContainer toasts={toasts} />
    </div>
  )
}
