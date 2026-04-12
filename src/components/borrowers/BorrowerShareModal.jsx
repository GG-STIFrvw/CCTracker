import { useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import {
  useMyBorrowerShares,
  useCreateBorrowerShare,
  useRevokeBorrowerShare,
} from '../../hooks/useBorrowerShares.js'
import useAppStore from '../../store/useAppStore.js'

export default function BorrowerShareModal({ borrower, onClose }) {
  const user = useAppStore((s) => s.user)
  const { data: shares = [] } = useMyBorrowerShares(borrower.id)
  const createShare = useCreateBorrowerShare()
  const revokeShare = useRevokeBorrowerShare()

  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  async function handleSend() {
    setEmailError('')
    setSuccessMsg('')
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Enter a valid email address')
      return
    }
    if (trimmed === user.email.toLowerCase()) {
      setEmailError('You cannot invite yourself')
      return
    }
    const alreadyShared = shares.some(
      (s) => s.viewer_email.toLowerCase() === trimmed && s.status !== 'declined'
    )
    if (alreadyShared) {
      setEmailError('An active invite already exists for this email')
      return
    }
    try {
      await createShare.mutateAsync({ viewerEmail: trimmed, borrower })
      setEmail('')
      setSuccessMsg(`Invite sent to ${trimmed}`)
    } catch (err) {
      setEmailError(err.message)
    }
  }

  return (
    <Modal title={`Share — ${borrower.full_name}`} onClose={onClose}>
      {/* Active shares */}
      <div className="mb-5">
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Active Shares
        </p>
        {shares.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">
            No active shares yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {shares.map((share) => (
              <div
                key={share.id}
                className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate">
                    {share.viewer_email}
                  </p>
                  <p
                    className={`text-xs mt-0.5 ${
                      share.status === 'active'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-yellow-600 dark:text-yellow-400'
                    }`}
                  >
                    {share.status}
                  </p>
                </div>
                <button
                  onClick={() =>
                    revokeShare.mutate({ shareId: share.id, borrowerId: borrower.id })
                  }
                  disabled={revokeShare.isPending}
                  className="text-xs text-red-500 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite form */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex flex-col gap-3">
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Invite Someone
        </p>
        <div>
          <input
            type="email"
            placeholder="viewer@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setEmailError('')
              setSuccessMsg('')
            }}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {emailError && (
            <p className="text-red-500 dark:text-red-400 text-xs mt-1">{emailError}</p>
          )}
          {successMsg && (
            <p className="text-green-600 dark:text-green-400 text-xs mt-1">{successMsg}</p>
          )}
        </div>
        <Button
          onClick={handleSend}
          disabled={createShare.isPending}
          className="w-full justify-center"
        >
          {createShare.isPending ? 'Sending…' : 'Send Invite'}
        </Button>
      </div>
    </Modal>
  )
}
