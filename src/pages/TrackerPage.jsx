import { useState, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useCards } from '../hooks/useCards.js'
import { useTransactions, usePayBulk } from '../hooks/useTransactions.js'
import { getRemainingBalance } from '../utils/money.js'
import Navbar from '../components/layout/Navbar.jsx'
import TrackerSummary from '../components/tracker/TrackerSummary.jsx'
import TransactionTable from '../components/tracker/TransactionTable.jsx'
import TransactionForm from '../components/tracker/TransactionForm.jsx'
import TransactionEditModal from '../components/tracker/TransactionEditModal.jsx'
import PaymentModal from '../components/tracker/PaymentModal.jsx'
import BulkPayBar from '../components/tracker/BulkPayBar.jsx'
import ExportButtons from '../components/tracker/ExportButtons.jsx'
import CloseCycleModal from '../components/tracker/CloseCycleModal.jsx'
import CycleHistoryList from '../components/tracker/CycleHistoryList.jsx'
import { useToast, ToastContainer } from '../components/ui/Toast.jsx'
import Button from '../components/ui/Button.jsx'
import { ReturnIcon } from '../components/ui/icons.jsx'

export default function TrackerPage() {
  const { cardId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const readOnly = searchParams.get('readOnly') === 'true'

  const { data: cards = [] } = useCards()
  const { data: transactions = [], isLoading } = useTransactions(cardId)
  const payBulk = usePayBulk()
  const { toasts, toast } = useToast()

  const [activeTab, setActiveTab] = useState('active')
  const [payingTransaction, setPayingTransaction] = useState(null)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [bulkPayMode, setBulkPayMode] = useState(false)
  const [selectedTransactions, setSelectedTransactions] = useState([])
  const [showCloseCycle, setShowCloseCycle] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const card = cards.find((c) => c.id === cardId)

  const selectedIds = useMemo(() => new Set(selectedTransactions.map(t => t.id)), [selectedTransactions])
  const selectedTotal = useMemo(
    () => selectedTransactions.reduce((sum, t) => sum + getRemainingBalance(t.amount, t.amount_paid), 0),
    [selectedTransactions]
  )

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (statusFilter !== 'all' && t.payment_status !== statusFilter) return false
      if (dateFrom && t.transaction_date < dateFrom) return false
      if (dateTo && t.transaction_date > dateTo) return false
      return true
    })
  }, [transactions, statusFilter, dateFrom, dateTo])

  const hasPaidTransactions = transactions.some(t => t.payment_status === 'paid')

  function handleToggleSelect(transaction) {
    setSelectedTransactions(prev =>
      prev.some(t => t.id === transaction.id)
        ? prev.filter(t => t.id !== transaction.id)
        : [...prev, transaction]
    )
  }

  function exitBulkPay() {
    setBulkPayMode(false)
    setSelectedTransactions([])
  }

  async function handlePaySelected() {
    if (selectedTransactions.length === 0) return
    try {
      await payBulk.mutateAsync({ cardId, transactions: selectedTransactions })
      toast(`${selectedTransactions.length} transaction${selectedTransactions.length !== 1 ? 's' : ''} marked as paid`, 'success')
      exitBulkPay()
    } catch {
      toast('Payment failed. Please try again.', 'error')
    }
  }

  const exportFilename = card ? `${card.nickname}-active-transactions`.replace(/\s+/g, '-') : 'transactions'
  const exportTitle = card ? `${card.nickname} — Active Transactions` : 'Active Transactions'

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

  if (!card) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <TrackerSummary card={card} transactions={transactions} />

      <main className="max-w-6xl mx-auto p-6">
        <button
          onClick={() => navigate(readOnly ? '/shared' : '/')}
          className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors mb-6"
        >
          <ReturnIcon className="w-3.5 h-3.5" />
          Back to {readOnly ? 'Shared with me' : 'Dashboard'}
        </button>

        {readOnly && (
          <div className="mb-4 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
            Viewing shared card — read only
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6">
          {['active', 'history'].map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); exitBulkPay(); setStatusFilter('all'); setDateFrom(''); setDateTo('') }}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-[#2D6A4F] dark:border-[#9FE870] text-[#2D6A4F] dark:text-[#9FE870]'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'active' && (
          <>
            {!readOnly && (
              <TransactionForm
                cardId={cardId}
                card={card}
                transactions={transactions}
                onSuccess={() => toast('Transaction added!', 'success')}
              />
            )}

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-3 mt-4 mb-2">
              {/* Status pills */}
              <div className="flex gap-1">
                {['all', 'unpaid', 'partial', 'paid'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    aria-pressed={statusFilter === s}
                    className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                      statusFilter === s
                        ? 'bg-[#9FE870]/20 text-[#2D6A4F] dark:text-[#9FE870] font-semibold'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>

              {/* Date range */}
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-[#9FE870]"
                  aria-label="From date"
                />
                <span aria-hidden="true">—</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-[#9FE870]"
                  aria-label="To date"
                />
                {(dateFrom || dateTo || statusFilter !== 'all') && (
                  <button
                    onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter('all') }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Action bar */}
            {!readOnly && transactions.length > 0 && (
              <div className="flex items-center justify-between mt-4 mb-3">
                <Button
                  variant={bulkPayMode ? 'primary' : 'ghost'}
                  className="text-xs py-1.5 px-3"
                  onClick={() => { setBulkPayMode(b => !b); setSelectedTransactions([]) }}
                >
                  {bulkPayMode ? 'Exit Bulk Pay' : 'Bulk Pay'}
                </Button>
                <ExportButtons
                  transactions={transactions}
                  filename={exportFilename}
                  title={exportTitle}
                />
              </div>
            )}

            {bulkPayMode && (
              <div className="mb-3">
                <BulkPayBar
                  selectedCount={selectedTransactions.length}
                  selectedTotal={selectedTotal}
                  onPaySelected={handlePaySelected}
                  onCancel={exitBulkPay}
                  isPending={payBulk.isPending}
                />
              </div>
            )}

            {isLoading ? (
              <p className="text-gray-500 text-center py-10 mt-6">Loading transactions…</p>
            ) : (
              <TransactionTable
                transactions={filteredTransactions}
                cardId={cardId}
                onPay={setPayingTransaction}
                onEdit={setEditingTransaction}
                readOnly={readOnly}
                bulkPayMode={bulkPayMode}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
              />
            )}

            {/* Close Cycle button */}
            {!readOnly && hasPaidTransactions && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowCloseCycle(true)}
                  className="text-xs text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Close Billing Cycle
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <CycleHistoryList cardId={cardId} cardName={card.nickname} />
        )}
      </main>

      {/* Modals */}
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

      {!readOnly && editingTransaction && (
        <TransactionEditModal
          transaction={editingTransaction}
          card={card}
          transactions={transactions}
          onClose={() => setEditingTransaction(null)}
          onSuccess={() => toast('Transaction updated!', 'success')}
        />
      )}

      {!readOnly && showCloseCycle && (
        <CloseCycleModal
          cardId={cardId}
          transactions={transactions}
          onClose={() => setShowCloseCycle(false)}
          onSuccess={() => {
            toast('Billing cycle closed!', 'success')
            setActiveTab('history')
          }}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  )
}
