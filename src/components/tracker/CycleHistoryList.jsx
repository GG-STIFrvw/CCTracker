import { useState } from 'react'
import { useBillingCycles, useCycleTransactions } from '../../hooks/useTransactions.js'
import { formatPeso } from '../../utils/money.js'
import TransactionTable from './TransactionTable.jsx'
import ExportButtons from './ExportButtons.jsx'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function CycleCard({ cycle, cardName, isExpanded, onToggle }) {
  const txList = cycle.transactions ?? []
  const totalCharged = txList.reduce((sum, t) => sum + Number(t.amount), 0)
  const totalPaid = txList.reduce((sum, t) => sum + Number(t.amount_paid), 0)
  const count = txList.length

  const { data: fullTransactions = [], isLoading } = useCycleTransactions(isExpanded ? cycle.id : null)

  const exportFilename = `${cardName}-${cycle.label}`.replace(/\s+/g, '-')
  const exportTitle = `${cardName} — ${cycle.label}`

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
        onClick={onToggle}
      >
        <div>
          <p className="font-semibold text-gray-900 dark:text-white text-sm">{cycle.label}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {formatDate(cycle.start_date)} – {formatDate(cycle.end_date)} · {count} transaction{count !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-6 text-right">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500">Charged</p>
            <p className="text-sm font-mono text-gray-900 dark:text-white">{formatPeso(totalCharged)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500">Paid</p>
            <p className="text-sm font-mono text-green-600 dark:text-green-400">{formatPeso(totalPaid)}</p>
          </div>
          <span className="text-gray-400 dark:text-gray-500 text-lg">{isExpanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex justify-end pt-3 pb-3">
            <ExportButtons
              transactions={fullTransactions}
              filename={exportFilename}
              title={exportTitle}
            />
          </div>
          {isLoading ? (
            <p className="text-gray-400 text-sm text-center py-8">Loading transactions…</p>
          ) : (
            <TransactionTable
              transactions={fullTransactions}
              cardId={cycle.card_id}
              onPay={null}
              readOnly={true}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default function CycleHistoryList({ cardId, cardName }) {
  const { data: cycles = [], isLoading } = useBillingCycles(cardId)
  const [expandedId, setExpandedId] = useState(null)

  if (isLoading) {
    return <p className="text-gray-400 text-sm text-center py-16">Loading history…</p>
  }

  if (cycles.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
        No billing cycles yet. Close your first cycle from the Active tab.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {cycles.map(cycle => (
        <CycleCard
          key={cycle.id}
          cycle={cycle}
          cardName={cardName}
          isExpanded={expandedId === cycle.id}
          onToggle={() => setExpandedId(expandedId === cycle.id ? null : cycle.id)}
        />
      ))}
    </div>
  )
}
