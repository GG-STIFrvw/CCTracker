import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCards } from '../hooks/useCards.js'
import { useTransactions } from '../hooks/useTransactions.js'
import Navbar from '../components/layout/Navbar.jsx'
import TrackerSummary from '../components/tracker/TrackerSummary.jsx'
import TransactionTable from '../components/tracker/TransactionTable.jsx'
import { useToast, ToastContainer } from '../components/ui/Toast.jsx'

export default function TrackerPage() {
  const { cardId } = useParams()
  const navigate = useNavigate()
  const { data: cards = [] } = useCards()
  const { data: transactions = [], isLoading } = useTransactions(cardId)
  const [payingTransaction, setPayingTransaction] = useState(null)
  const { toasts, toast } = useToast()

  const card = cards.find((c) => c.id === cardId)

  // Cards loaded but this cardId not found
  if (cards.length > 0 && !card) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Card not found.</p>
          <button onClick={() => navigate('/')} className="text-blue-400 hover:underline">
            ← Go back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (!card) return null // still loading cards

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <TrackerSummary card={card} transactions={transactions} />

      <main className="max-w-6xl mx-auto p-6">
        <button
          onClick={() => navigate('/')}
          className="text-blue-400 hover:underline text-sm mb-6 block"
        >
          ← Back to Dashboard
        </button>

        {/* TransactionForm will be wired in Task 13 */}
        <div
          id="transaction-form-placeholder"
          className="bg-gray-900 border border-dashed border-gray-600 rounded-xl p-4 mb-6 text-gray-500 text-sm text-center"
        >
          Transaction form loading…
        </div>

        {isLoading ? (
          <p className="text-gray-500 text-center py-10">Loading transactions…</p>
        ) : (
          <TransactionTable
            transactions={transactions}
            cardId={cardId}
            onPay={setPayingTransaction}
          />
        )}
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  )
}
