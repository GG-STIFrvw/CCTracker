import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBorrowers } from '../hooks/useBorrowers.js'
import { useLoans } from '../hooks/useLoans.js'
import { getLoanInitials, getLoanTotalPaid, getLoanRemaining } from '../utils/loans.js'
import { formatPeso, addMoney } from '../utils/money.js'
import Navbar from '../components/layout/Navbar.jsx'
import LoanTable from '../components/borrowers/LoanTable.jsx'
import LoanForm from '../components/borrowers/LoanForm.jsx'
import LoanPaymentModal from '../components/borrowers/LoanPaymentModal.jsx'
import { useToast, ToastContainer } from '../components/ui/Toast.jsx'
import Button from '../components/ui/Button.jsx'

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
  const { data: borrowers = [] } = useBorrowers()
  const { data: loans = [], isLoading } = useLoans(borrowerId)
  const { toasts, toast } = useToast()

  const [showAddLoan, setShowAddLoan] = useState(false)
  const [payingLoan, setPayingLoan] = useState(null)

  const borrower = borrowers.find((b) => b.id === borrowerId)

  if (borrowers.length > 0 && !borrower) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Borrower not found.</p>
          <button onClick={() => navigate('/')} className="text-blue-400 hover:underline">
            ← Go back to Dashboard
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
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{borrower.full_name}</h1>
            <p className="text-gray-400 text-sm">{borrower.phone} · {borrower.email}</p>
            {borrower.address && (
              <p className="text-gray-400 text-xs mt-0.5">{borrower.address}</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-6 text-center sm:text-right">
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Total Loaned</p>
              <p className="text-gray-900 dark:text-white font-semibold">{formatPeso(totalLoaned)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Total Paid</p>
              <p className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatPeso(totalPaid)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Outstanding</p>
              <p className="text-red-500 dark:text-red-400 font-semibold">{formatPeso(outstanding)}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-6">
        <button
          onClick={() => navigate('/')}
          className="text-blue-400 hover:underline text-sm mb-6 block"
        >
          ← Back to Dashboard
        </button>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Loans ({loans.length})
          </h2>
          <Button onClick={() => setShowAddLoan(true)}>+ Add Loan</Button>
        </div>

        {isLoading ? (
          <p className="text-gray-500 text-center py-10">Loading loans…</p>
        ) : (
          <LoanTable loans={loans} onPay={setPayingLoan} />
        )}
      </main>

      {showAddLoan && (
        <LoanForm
          borrowerId={borrowerId}
          onClose={() => setShowAddLoan(false)}
          onSuccess={() => toast('Loan added!', 'success')}
        />
      )}

      {payingLoan && (
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
