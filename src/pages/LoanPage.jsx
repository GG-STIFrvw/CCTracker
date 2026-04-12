import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useBorrowers } from '../hooks/useBorrowers.js'
import { useLoans } from '../hooks/useLoans.js'
import { useSharedBorrowerInfo } from '../hooks/useBorrowerShares.js'
import { getLoanInitials, getLoanTotalPaid, getLoanRemaining } from '../utils/loans.js'
import { formatPeso, addMoney } from '../utils/money.js'
import Navbar from '../components/layout/Navbar.jsx'
import LoanTable from '../components/borrowers/LoanTable.jsx'
import LoanForm from '../components/borrowers/LoanForm.jsx'
import LoanPaymentModal from '../components/borrowers/LoanPaymentModal.jsx'
import BorrowerShareModal from '../components/borrowers/BorrowerShareModal.jsx'
import { useToast, ToastContainer } from '../components/ui/Toast.jsx'
import Button from '../components/ui/Button.jsx'
import { ReturnIcon } from '../components/ui/icons.jsx'

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-rose-500', 'bg-amber-500', 'bg-cyan-500',
]

function pickColor(name) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export default function LoanPage() {
  const { borrowerId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const readOnly = searchParams.get('readOnly') === 'true'

  const { data: borrowers = [] } = useBorrowers()
  const { data: loans = [], isLoading } = useLoans(borrowerId)
  const { data: sharedInfo } = useSharedBorrowerInfo(borrowerId, { enabled: readOnly })
  const { toasts, toast } = useToast()

  const [showAddLoan, setShowAddLoan] = useState(false)
  const [payingLoan, setPayingLoan] = useState(null)
  const [showShare, setShowShare] = useState(false)

  // Owner mode: find borrower from owned list
  // Read-only mode: construct borrower object from denormalized share data
  let borrower = null
  if (readOnly) {
    if (sharedInfo) {
      borrower = {
        id: sharedInfo.borrower_id,
        full_name: sharedInfo.borrower_name,
        phone: sharedInfo.borrower_phone,
        email: sharedInfo.borrower_email,
        address: null,
      }
    }
  } else {
    borrower = borrowers.find((b) => b.id === borrowerId)
  }

  // Not-found guard (owner mode only — viewer uses sharedInfo path)
  if (!readOnly && borrowers.length > 0 && !borrower) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Borrower not found.</p>
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
            <ReturnIcon className="w-4 h-4 inline mr-1" /> Go back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (!borrower) return null

  const totalLoaned = loans.reduce((sum, l) => addMoney(sum, l.amount), 0)
  const totalPaid = loans.reduce((sum, l) => addMoney(sum, getLoanTotalPaid(l.loan_payments)), 0)
  const outstanding = loans.reduce(
    (sum, l) => addMoney(sum, getLoanRemaining(l.amount, getLoanTotalPaid(l.loan_payments))),
    0
  )

  const initials = getLoanInitials(borrower.full_name)
  const avatarColor = pickColor(borrower.full_name)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />

      {/* Summary header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div
            className={`${avatarColor} w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0`}
          >
            {initials}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {borrower.full_name}
            </h1>
            <p className="text-gray-400 text-sm">{borrower.phone} · {borrower.email}</p>
            {borrower.address && (
              <p className="text-gray-400 text-xs mt-0.5">{borrower.address}</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-6 text-center sm:text-right">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Total Loaned</p>
              <p className="text-gray-900 dark:text-white font-black font-mono text-lg">{formatPeso(totalLoaned)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Total Paid</p>
              <p className="text-emerald-600 dark:text-emerald-400 font-black font-mono text-lg">{formatPeso(totalPaid)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Outstanding</p>
              <p className="text-red-500 dark:text-red-400 font-black font-mono text-lg">{formatPeso(outstanding)}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-6">
        {/* Read-only banner */}
        {readOnly && (
          <div className="mb-4 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
            Viewing shared borrower — read only
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Loans ({loans.length})
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(readOnly ? '/shared-borrowers' : '/')}
              className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ReturnIcon className="w-3.5 h-3.5" />
              Back to {readOnly ? 'Shared Borrowers' : 'Dashboard'}
            </button>
            {!readOnly && (
              <>
                <button
                  onClick={() => setShowShare(true)}
                  className="text-xs text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Share
                </button>
                <Button onClick={() => setShowAddLoan(true)}>+ Add Loan</Button>
              </>
            )}
          </div>
        </div>

        {isLoading ? (
          <p className="text-gray-500 text-center py-10">Loading loans…</p>
        ) : (
          <LoanTable loans={loans} onPay={setPayingLoan} readOnly={readOnly} borrowerId={borrowerId} />
        )}
      </main>

      {showShare && (
        <BorrowerShareModal
          borrower={borrower}
          onClose={() => setShowShare(false)}
        />
      )}

      {!readOnly && showAddLoan && (
        <LoanForm
          borrowerId={borrowerId}
          onClose={() => setShowAddLoan(false)}
          onSuccess={() => toast('Loan added!', 'success')}
        />
      )}

      {!readOnly && payingLoan && (
        <LoanPaymentModal
          loan={payingLoan}
          onClose={() => setPayingLoan(null)}
          onSuccess={() => {
            setPayingLoan(null)
            toast('Payment recorded!', 'success')
          }}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  )
}
