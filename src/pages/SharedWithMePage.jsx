import { useNavigate } from 'react-router-dom'
import Navbar from '../components/layout/Navbar.jsx'
import { LinkIcon, ReturnIcon } from '../components/ui/icons.jsx'
import CardTile from '../components/cards/CardTile.jsx'
import {
  useSharedWithMe,
  usePendingInvites,
  useAcceptShare,
  useDeclineShare,
} from '../hooks/useShares.js'
import { useCards } from '../hooks/useCards.js'
import useAppStore from '../store/useAppStore.js'
import { useToast, ToastContainer } from '../components/ui/Toast.jsx'

export default function SharedWithMePage() {
  const navigate = useNavigate()
  const user = useAppStore((s) => s.user)
  const { data: activeShares = [] } = useSharedWithMe()
  const { data: pendingInvites = [] } = usePendingInvites()
  const { data: allCards = [] } = useCards()
  const acceptShare = useAcceptShare()
  const declineShare = useDeclineShare()
  const { toasts, toast } = useToast()

  // All card IDs from active shares
  const sharedCardIds = activeShares.flatMap((s) => s.card_ids)

  // Filter to cards that belong to someone else (shared to this user)
  const sharedCards = allCards.filter(
    (c) => c.user_id !== user?.id && sharedCardIds.includes(c.id)
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />

      <main className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Cards shared with me
          </h2>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ReturnIcon className="w-3.5 h-3.5" />
            Back to Dashboard
          </button>
        </div>

        {/* Pending invites section */}
        {pendingInvites.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Pending invites ({pendingInvites.length})
            </h2>
            <div className="flex flex-col gap-2">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between gap-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="text-gray-900 dark:text-white text-sm font-medium">
                      {invite.owner_email}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                      Wants to share {invite.card_ids.length} card
                      {invite.card_ids.length !== 1 ? 's' : ''} with you
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => declineShare.mutate(invite.id)}
                      disabled={declineShare.isPending}
                      className="text-xs text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg"
                    >
                      Decline
                    </button>
                    <button
                      onClick={async () => {
                        await acceptShare.mutateAsync(invite.id)
                        toast('Invite accepted!', 'success')
                      }}
                      disabled={acceptShare.isPending}
                      className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shared cards section */}
        <div>
          {sharedCards.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl">
              <div className="flex justify-center mb-3">
                <LinkIcon className="w-12 h-12 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No cards shared with you yet.
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                When someone shares cards with you, they'll appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sharedCards.map((card) => (
                <CardTile
                  key={card.id}
                  card={card}
                  readOnly
                  onEdit={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  )
}
