import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useCards } from '../hooks/useCards.js'
import { useTransactions } from '../hooks/useTransactions.js'
import Navbar from '../components/layout/Navbar.jsx'
import TrackerSummary from '../components/tracker/TrackerSummary.jsx'
import TransactionTable from '../components/tracker/TransactionTable.jsx'
import TransactionForm from '../components/tracker/TransactionForm.jsx'
import PaymentModal from '../components/tracker/PaymentModal.jsx'
import { useToast, ToastContainer } from '../components/ui/Toast.jsx'
import { ReturnIcon } from '../components/ui/icons.jsx'

export default function TrackerPage() {
  const { cardId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const readOnly = searchParams.get('readOnly') === 'true'

  const { data: cards = [] } = useCards()
  const { data: transactions = [], isLoading } = useTransactions(cardId)
  const [payingTransaction, setPayingTransaction] = useState(null)
  const { toasts, toast } = useToast()

  const card = cards.find((c) => c.id === cardId)

  // Cards loaded but this cardId not found
  if (cards.length > 0 && !card) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Card not found.</p>
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
            <ReturnIcon className="w-4 h-4 inline mr-1" /> Go back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (!card) return null // still loading cards

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <TrackerSummary card={card} transactions={transactions} />

      <main className="max-w-6xl mx-auto p-6">
        <button
          onClick={() => navigate(readOnly ? '/shared' : '/')}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white text-sm mb-4 transition-colors"
        >
          <ReturnIcon className="w-4 h-4" />
          Back to {readOnly ? 'Shared with me' : 'Dashboard'}
        </button>

        {/* Read-only banner */}
        {readOnly && (
          <div className="mb-4 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
            Viewing shared card — read only
          </div>
        )}

        {!readOnly && (
          <TransactionForm
            cardId={cardId}
            card={card}
            transactions={transactions}
            onSuccess={() => toast('Transaction added!', 'success')}
          />
        )}

        {isLoading ? (
          <p className="text-gray-500 text-center py-10">Loading transactions…</p>
        ) : (
          <TransactionTable
            transactions={transactions}
            cardId={cardId}
            onPay={setPayingTransaction}
            readOnly={readOnly}
          />
        )}
      </main>

      {!readOnly && payingTransaction && (
        <PaymentModal
          transaction={payingTransaction}
          onClose={() => setPayingTransaction(null)}
          onSuccess={() => {
            setPayingTransaction(null)
            toast('Payment recorded!', 'success')
          }}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  )
}
