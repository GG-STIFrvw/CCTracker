import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExpenses } from '../hooks/useExpenses.js'
import {
  filterByMonth,
  groupByCategory,
  groupByPaymentMethod,
  CATEGORIES,
  PAYMENT_METHODS,
} from '../utils/expenses.js'
import { addMoney } from '../utils/money.js'
import Navbar from '../components/layout/Navbar.jsx'
import ExpenseSummary from '../components/expenses/ExpenseSummary.jsx'
import CategoryTiles from '../components/expenses/CategoryTiles.jsx'
import ExpenseTable from '../components/expenses/ExpenseTable.jsx'
import ExpenseForm from '../components/expenses/ExpenseForm.jsx'
import { useToast, ToastContainer } from '../components/ui/Toast.jsx'
import Button from '../components/ui/Button.jsx'
import { ReturnIcon } from '../components/ui/icons.jsx'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export default function ExpensesPage() {
  const navigate = useNavigate()
  const { data: allExpenses = [], isLoading } = useExpenses()
  const { toasts, toast } = useToast()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1) // 1-based
  const [activeCategory, setActiveCategory] = useState(null)
  const [activePayment, setActivePayment] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
  }
  function nextMonth() {
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
    if (isCurrentMonth) return
    if (month === 12) { setMonth(1); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
  }

  const monthExpenses = useMemo(
    () => filterByMonth(allExpenses, year, month),
    [allExpenses, year, month]
  )

  const categoryTotals = useMemo(() => groupByCategory(monthExpenses), [monthExpenses])
  const paymentTotals = useMemo(() => groupByPaymentMethod(monthExpenses), [monthExpenses])
  const monthTotal = useMemo(
    () => monthExpenses.reduce((sum, e) => addMoney(sum, e.amount), 0),
    [monthExpenses]
  )

  const filteredExpenses = useMemo(() => {
    let list = monthExpenses
    if (activeCategory) list = list.filter((e) => e.category === activeCategory)
    if (activePayment) list = list.filter((e) => e.payment_method === activePayment)
    return list
  }, [monthExpenses, activeCategory, activePayment])

  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <ExpenseSummary
        total={monthTotal}
        paymentTotals={paymentTotals}
        monthLabel={monthLabel}
      />

      <main className="max-w-6xl mx-auto p-6">
        {/* Back + Add */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ReturnIcon className="w-3.5 h-3.5" />
            Back to Dashboard
          </button>
          <Button onClick={() => setShowForm(true)}>+ Add Expense</Button>
        </div>

        {/* Month navigator */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={prevMonth}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            ‹
          </button>
          <span className="text-sm font-semibold text-gray-900 dark:text-white w-36 text-center">
            {monthLabel}
          </span>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ›
          </button>
        </div>

        {/* Category tiles */}
        <CategoryTiles
          totals={categoryTotals}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
        />

        {/* Payment method filter pills */}
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setActivePayment(null)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              !activePayment
                ? 'bg-[#9FE870]/20 border-[#9FE870] text-[#2D6A4F] dark:text-[#9FE870] font-semibold'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
            }`}
          >
            All Methods
          </button>
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.value}
              onClick={() => setActivePayment(activePayment === m.value ? null : m.value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                activePayment === m.value
                  ? 'bg-[#9FE870]/20 border-[#9FE870] text-[#2D6A4F] dark:text-[#9FE870] font-semibold'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {isLoading ? (
          <p className="text-gray-500 text-center py-10">Loading expenses…</p>
        ) : (
          <ExpenseTable
            expenses={filteredExpenses}
            onEdit={(e) => setEditingExpense(e)}
          />
        )}
      </main>

      {showForm && (
        <ExpenseForm
          onClose={() => setShowForm(false)}
          onSuccess={() => toast('Expense added!', 'success')}
        />
      )}

      {editingExpense && (
        <ExpenseForm
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
          onSuccess={() => { toast('Expense updated!', 'success'); setEditingExpense(null) }}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  )
}
