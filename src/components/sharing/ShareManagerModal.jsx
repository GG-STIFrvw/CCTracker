import { useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { useMyShares, useCreateShare, useRevokeShare } from '../../hooks/useShares.js'
import { useCards } from '../../hooks/useCards.js'
import useAppStore from '../../store/useAppStore.js'

export default function ShareManagerModal({ onClose }) {
  const user = useAppStore((s) => s.user)
  const { data: shares = [] } = useMyShares()
  const { data: cards = [] } = useCards()
  const createShare = useCreateShare()
  const revokeShare = useRevokeShare()

  const [email, setEmail] = useState('')
  const [selectedCardIds, setSelectedCardIds] = useState([])
  const [emailError, setEmailError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Only show own cards for sharing (not cards shared with the owner)
  const ownCards = cards.filter((c) => c.user_id === user?.id)

  function toggleCard(cardId) {
    setSelectedCardIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    )
  }

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
    if (selectedCardIds.length === 0) {
      setEmailError('Select at least one card')
      return
    }
    try {
      await createShare.mutateAsync({ viewerEmail: trimmed, cardIds: selectedCardIds })
      setEmail('')
      setSelectedCardIds([])
      setSuccessMsg(`Invite sent to ${trimmed}`)
    } catch (err) {
      if (err.code === '23505') {
        setEmailError('An active invite already exists for this email')
      } else {
        setEmailError(err.message)
      }
    }
  }

  function getCardNames(cardIds) {
    return cardIds
      .map((id) => ownCards.find((c) => c.id === id)?.nickname ?? 'Unknown card')
      .join(', ')
  }

  const activeShares = shares.filter((s) => s.status !== 'declined')

  return (
    <Modal title="Share Cards" onClose={onClose}>
      {/* Existing shares */}
      <div className="mb-5">
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Active Shares
        </p>
        {activeShares.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">No active shares yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {activeShares.map((share) => (
              <div
                key={share.id}
                className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate">
                    {share.viewer_email}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {getCardNames(share.card_ids)} ·{' '}
                    <span
                      className={
                        share.status === 'active'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-yellow-600 dark:text-yellow-400'
                      }
                    >
                      {share.status}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => revokeShare.mutate(share.id)}
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

        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Select cards to share:
          </p>
          {ownCards.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">
              No cards to share yet.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {ownCards.map((card) => (
                <label
                  key={card.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedCardIds.includes(card.id)}
                    onChange={() => toggleCard(card.id)}
                    className="accent-blue-500 w-3.5 h-3.5"
                  />
                  <span className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: card.color_primary }}
                    />
                    {card.nickname}
                    <span className="text-gray-400 dark:text-gray-500 text-xs">
                      · {card.bank_name}
                    </span>
                  </span>
                </label>
              ))}
            </div>
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
