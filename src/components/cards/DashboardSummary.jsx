import { useQueries } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase.js'
import { getRemainingBalance, formatPeso } from '../../utils/money.js'

function makeTransactionQuery(cardId) {
  return {
    queryKey: ['transactions', cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('card_id', cardId)
        .eq('is_archived', false)
        .is('cycle_id', null)
        .order('transaction_date', { ascending: false })
      if (error) throw error
      return data
    },
  }
}

export default function DashboardSummary({ cards }) {
  const results = useQueries({ queries: cards.map((c) => makeTransactionQuery(c.id)) })

  const allTransactions = results.flatMap((r) => r.data ?? [])
  const totalOutstanding = allTransactions.reduce(
    (sum, t) => sum + getRemainingBalance(t.amount, t.amount_paid),
    0
  )
  const totalLimit = cards.reduce((sum, c) => sum + (c.spending_limit || 0), 0)
  const utilization = totalLimit > 0 ? Math.round((totalOutstanding / totalLimit) * 100) : null

  if (cards.length === 0) return null

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
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
        <p className="text-2xl font-black font-mono text-gray-900 dark:text-white">
          {utilization !== null ? `${utilization}%` : '—'}
        </p>
      </div>
    </div>
  )
}
