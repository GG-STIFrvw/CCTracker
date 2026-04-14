import { useState } from 'react'
import { formatPeso } from '../../utils/money.js'
import { getCategoryLabel, getPaymentMethodLabel, CATEGORIES } from '../../utils/expenses.js'
import { useArchiveExpense } from '../../hooks/useExpenses.js'
import Button from '../ui/Button.jsx'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function CategoryBadge({ category }) {
  const cat = CATEGORIES.find((c) => c.value === category)
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{
        backgroundColor: cat ? cat.color + '22' : '#9CA3AF22',
        color: cat ? cat.color : '#9CA3AF',
      }}
    >
      {getCategoryLabel(category)}
    </span>
  )
}

export default function ExpenseTable({ expenses, onEdit }) {
  const archive = useArchiveExpense()
  const [confirmArchiveId, setConfirmArchiveId] = useState(null)

  if (!expenses || expenses.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
        No expenses for this period.
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left whitespace-nowrap">Date</th>
              <th className="px-4 py-3 text-left whitespace-nowrap">Category</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">Amount</th>
              <th className="px-4 py-3 text-left whitespace-nowrap">Payment</th>
              <th className="px-4 py-3 text-left">Notes</th>
              <th className="px-4 py-3 text-center whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {expenses.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-gray-700 dark:text-gray-200">
                <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400">
                  {formatDate(e.expense_date)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <CategoryBadge category={e.category} />
                </td>
                <td className="px-4 py-3 max-w-[180px] truncate">{e.description}</td>
                <td className="px-4 py-3 text-right font-mono text-red-600 dark:text-red-400">
                  {formatPeso(e.amount)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400">
                  {getPaymentMethodLabel(e.payment_method)}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[120px] truncate">
                  {e.notes || '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex gap-2 justify-center items-center">
                    <Button
                      variant="ghost"
                      className="text-xs py-1 px-2"
                      onClick={() => onEdit(e)}
                    >
                      Edit
                    </Button>
                    {confirmArchiveId === e.id ? (
                      <span className="flex items-center gap-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Archive?</span>
                        <button
                          onClick={() => { archive.mutate(e.id); setConfirmArchiveId(null) }}
                          className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
                          disabled={archive.isPending}
                        >
                          Yes
                        </button>
                        <span className="text-gray-300 dark:text-gray-600">/</span>
                        <button
                          onClick={() => setConfirmArchiveId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmArchiveId(e.id)}
                        className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-xs transition-colors"
                        disabled={archive.isPending}
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
