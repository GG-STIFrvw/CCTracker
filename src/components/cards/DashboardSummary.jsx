import { useQueries } from '@tanstack/react-query'
import { makeTransactionQuery } from '../../hooks/useTransactions.js'
import { getRemainingBalance, formatPeso } from '../../utils/money.js'

export default function DashboardSummary({ cards }) {
  const results = useQueries({ queries: cards.map((c) => makeTransactionQuery(c.id)) })

  const isLoading = results.some((r) => r.isLoading)

  const allTransactions = results.flatMap((r) => r.data ?? [])
  const totalOutstanding = allTransactions.reduce(
    (sum, t) => sum + getRemainingBalance(t.amount, t.amount_paid),
    0
  )
  const totalLimit = cards.reduce((sum, c) => sum + (c.spending_limit || 0), 0)
  const utilization = totalLimit > 0 ? Math.round((totalOutstanding / totalLimit) * 100) : null

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 animate-pulse">
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
            <div className="h-7 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
        <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">
          Outstanding
        </p>
        <p className="text-2xl font-black font-mono text-red-600 dark:text-red-400">
          {formatPeso(totalOutstanding)}
        </p>
      </div>
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
        <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">
          Total Limit
        </p>
        <p className="text-2xl font-black font-mono text-gray-900 dark:text-white">
          {formatPeso(totalLimit)}
        </p>
      </div>
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
        <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">
          Utilization
        </p>
        <p className={`text-2xl font-black font-mono ${
          utilization !== null && utilization > 100
            ? 'text-red-600 dark:text-red-400'
            : 'text-gray-900 dark:text-white'
        }`}>
          {utilization !== null ? `${utilization}%` : '—'}
        </p>
      </div>
    </div>
  )
}
