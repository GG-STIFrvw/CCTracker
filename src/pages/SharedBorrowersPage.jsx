import Navbar from '../components/layout/Navbar.jsx'
import { BalanceIcon } from '../components/ui/icons.jsx'
import BorrowerTile from '../components/borrowers/BorrowerTile.jsx'
import {
  useSharedBorrowersWithMe,
  usePendingBorrowerInvites,
  useAcceptBorrowerShare,
  useDeclineBorrowerShare,
} from '../hooks/useBorrowerShares.js'
import { useToast, ToastContainer } from '../components/ui/Toast.jsx'

export default function SharedBorrowersPage() {
  const { data: activeShares = [] } = useSharedBorrowersWithMe()
  const { data: pendingInvites = [] } = usePendingBorrowerInvites()
  const acceptShare = useAcceptBorrowerShare()
  const declineShare = useDeclineBorrowerShare()
  const { toasts, toast } = useToast()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />

      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Shared Borrowers
        </h1>

        {/* Pending invites */}
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
                      Wants to share <strong>{invite.borrower_name}</strong>'s loan data with you
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

        {/* Shared borrowers grid */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Borrowers shared with me
          </h2>
          {activeShares.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl">
              <div className="flex justify-center mb-3">
                <BalanceIcon className="w-12 h-12 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No borrowers shared with you yet.
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                When someone shares a borrower with you, they'll appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeShares.map((share) => {
                const pseudoBorrower = {
                  id: share.borrower_id,
                  full_name: share.borrower_name,
                  phone: share.borrower_phone,
                  email: share.borrower_email,
                }
                return (
                  <BorrowerTile
                    key={share.id}
                    borrower={pseudoBorrower}
                    readOnly
                    onEdit={() => {}}
                  />
                )
              })}
            </div>
          )}
        </div>
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  )
}
