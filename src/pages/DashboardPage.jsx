import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/layout/Navbar.jsx'
import CardTile from '../components/cards/CardTile.jsx'
import CardForm from '../components/cards/CardForm.jsx'
import ShareManagerModal from '../components/sharing/ShareManagerModal.jsx'
import { useCards } from '../hooks/useCards.js'
import useAppStore from '../store/useAppStore.js'
import Button from '../components/ui/Button.jsx'
import { useToast, ToastContainer } from '../components/ui/Toast.jsx'
import BorrowerTile from '../components/borrowers/BorrowerTile.jsx'
import BorrowerForm from '../components/borrowers/BorrowerForm.jsx'
import { useBorrowers } from '../hooks/useBorrowers.js'
import { BalanceIcon, CreditCardIcon } from '../components/ui/icons.jsx'
import { useExpenses } from '../hooks/useExpenses.js'
import { filterByMonth } from '../utils/expenses.js'
import { addMoney, formatPeso } from '../utils/money.js'
import ExpenseForm from '../components/expenses/ExpenseForm.jsx'
import DashboardSummary from '../components/cards/DashboardSummary.jsx'

export default function DashboardPage() {
  const user = useAppStore((s) => s.user)
  const { data: cards = [], isLoading, error } = useCards()
  const [showAdd, setShowAdd] = useState(false)
  const [editingCard, setEditingCard] = useState(null)
  const [showShare, setShowShare] = useState(false)
  const { toasts, toast } = useToast()
  const { data: borrowers = [], isLoading: loadingBorrowers } = useBorrowers()
  const [showAddBorrower, setShowAddBorrower] = useState(false)
  const [editingBorrower, setEditingBorrower] = useState(null)

  const navigate = useNavigate()
  const { data: allExpenses = [] } = useExpenses()
  const [showAddExpense, setShowAddExpense] = useState(false)

  const now = new Date()
  const thisMonthExpenses = filterByMonth(allExpenses, now.getFullYear(), now.getMonth() + 1)
  const thisMonthTotal = thisMonthExpenses.reduce((sum, e) => addMoney(sum, e.amount), 0)
  const MONTH_NAME = now.toLocaleString('en-PH', { month: 'long' })

  // Only show cards owned by this user on the dashboard
  const ownCards = cards.filter((c) => c.user_id === user?.id)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />

      <main className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Cards</h1>
            <p className="text-gray-500 dark:text-gray-500 text-sm mt-0.5">
              {ownCards.length} card{ownCards.length !== 1 ? 's' : ''} tracked
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setShowShare(true)}>
              Share
            </Button>
            <Button onClick={() => setShowAdd(true)}>+ Add Card</Button>
          </div>
        </div>

        {isLoading && (
          <div className="text-gray-500 text-center py-20">Loading cards…</div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-xl p-4 text-red-600 dark:text-red-300 text-sm">
            Failed to load cards: {error.message}
          </div>
        )}

        {!isLoading && !error && ownCards.length === 0 && (
          <div className="text-center py-24 border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl">
            <div className="flex justify-center mb-4">
              <CreditCardIcon className="w-14 h-14 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-gray-700 dark:text-gray-300 text-lg font-medium">No cards yet</p>
            <p className="text-gray-500 text-sm mt-2 mb-6">
              Add your first credit card to start tracking spending
            </p>
            <Button onClick={() => setShowAdd(true)}>+ Add Your First Card</Button>
          </div>
        )}

        {!isLoading && !error && ownCards.length > 0 && (
          <DashboardSummary cards={ownCards} />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ownCards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              onEdit={(c) => setEditingCard(c)}
            />
          ))}
        </div>

        {/* Borrowers section */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Borrowers</h1>
              <p className="text-gray-500 dark:text-gray-500 text-sm mt-0.5">
                {borrowers.length} borrower{borrowers.length !== 1 ? 's' : ''} tracked
              </p>
            </div>
            <Button onClick={() => setShowAddBorrower(true)}>+ Add Borrower</Button>
          </div>

          {loadingBorrowers && (
            <div className="text-gray-500 text-center py-10">Loading borrowers…</div>
          )}

          {!loadingBorrowers && borrowers.length === 0 && (
            <div className="text-center py-16 border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl">
              <div className="flex justify-center mb-3">
                <BalanceIcon className="w-12 h-12 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-gray-700 dark:text-gray-300 font-medium">No borrowers yet</p>
              <p className="text-gray-500 text-sm mt-1 mb-5">
                Track money you lend to friends or family
              </p>
              <Button onClick={() => setShowAddBorrower(true)}>+ Add Your First Borrower</Button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {borrowers.map((b) => (
              <BorrowerTile key={b.id} borrower={b} onEdit={(b) => setEditingBorrower(b)} />
            ))}
          </div>
        </div>

        {/* Expenses section */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Expenses</h1>
              <p className="text-gray-500 dark:text-gray-500 text-sm mt-0.5">
                {thisMonthExpenses.length} expense{thisMonthExpenses.length !== 1 ? 's' : ''} this month
              </p>
            </div>
            <Button onClick={() => setShowAddExpense(true)}>+ Add Expense</Button>
          </div>

          <div
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 cursor-pointer hover:shadow-md transition-shadow max-w-xs"
            onClick={() => navigate('/expenses')}
          >
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">
              {MONTH_NAME.toUpperCase()}
            </p>
            <p className="text-3xl font-black font-mono text-red-600 dark:text-red-400">
              {formatPeso(thisMonthTotal)}
            </p>
            <p className="text-xs text-gray-400 mt-3 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              View all expenses →
            </p>
          </div>
        </div>
      </main>

      {showAdd && (
        <CardForm
          onClose={() => setShowAdd(false)}
          onSuccess={() => toast('Card added!', 'success')}
        />
      )}

      {editingCard && (
        <CardForm
          card={editingCard}
          onClose={() => setEditingCard(null)}
          onSuccess={() => toast('Card updated!', 'success')}
        />
      )}

      {showShare && <ShareManagerModal onClose={() => setShowShare(false)} />}

      {showAddBorrower && (
        <BorrowerForm
          onClose={() => setShowAddBorrower(false)}
          onSuccess={() => toast('Borrower added!', 'success')}
        />
      )}
      {editingBorrower && (
        <BorrowerForm
          borrower={editingBorrower}
          onClose={() => setEditingBorrower(null)}
          onSuccess={() => toast('Borrower updated!', 'success')}
        />
      )}

      {showAddExpense && (
        <ExpenseForm
          onClose={() => setShowAddExpense(false)}
          onSuccess={() => toast('Expense added!', 'success')}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  )
}
