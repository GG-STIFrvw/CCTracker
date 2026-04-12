import { useState, useMemo } from 'react'
import { formatPeso, getRemainingBalance } from '../../utils/money.js'
import { useArchiveTransaction } from '../../hooks/useTransactions.js'
import { useTransactionAttachmentCounts } from '../../hooks/useAttachments.js'
import AttachmentModal from '../ui/AttachmentModal.jsx'
import Badge from '../ui/Badge.jsx'
import Button from '../ui/Button.jsx'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function TransactionTable({ transactions, cardId, onPay, readOnly = false }) {
  const archive = useArchiveTransaction()
  const [confirmArchiveId, setConfirmArchiveId] = useState(null)
  const [attachingTxId, setAttachingTxId] = useState(null)

  const txIds = useMemo(() => transactions.map((t) => t.id), [transactions])
  const { data: attCounts = {} } = useTransactionAttachmentCounts(txIds)

  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
        No transactions yet. Add your first one above.
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
              <th className="px-4 py-3 text-right whitespace-nowrap">Amount</th>
              <th className="px-4 py-3 text-left whitespace-nowrap">Due Date</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">Paid</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">Remaining</th>
              <th className="px-4 py-3 text-center whitespace-nowrap">Status</th>
              <th className="px-4 py-3 text-left">Notes</th>
              <th className="px-4 py-3 text-center whitespace-nowrap">Files</th>
              {!readOnly && (
                <th className="px-4 py-3 text-center whitespace-nowrap">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {transactions.map((t) => {
              const count = attCounts[t.id] || 0
              return (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-gray-700 dark:text-gray-200">
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(t.transaction_date)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatPeso(t.amount)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {formatDate(t.payment_due_date)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-green-600 dark:text-green-400">
                    {formatPeso(t.amount_paid)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-red-600 dark:text-red-400">
                    {formatPeso(getRemainingBalance(t.amount, t.amount_paid))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge status={t.payment_status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[150px] truncate">
                    {t.notes || '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {(!readOnly || count > 0) && (
                      <button
                        onClick={() => setAttachingTxId(t.id)}
                        className="relative inline-flex items-center gap-1 text-gray-400 hover:text-[#2D6A4F] dark:hover:text-[#9FE870] transition-colors text-xs"
                        title="Attachments"
                      >
                        📎
                        {count > 0 && (
                          <span className="bg-[#9FE870]/20 text-[#2D6A4F] dark:text-[#9FE870] text-xs font-medium px-1.5 py-0.5 rounded-full leading-none">
                            {count}
                          </span>
                        )}
                      </button>
                    )}
                  </td>
                  {!readOnly && (
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-2 justify-center items-center">
                        {t.payment_status !== 'paid' && (
                          <Button
                            variant="ghost"
                            className="text-xs py-1 px-2"
                            onClick={() => onPay(t)}
                          >
                            Pay
                          </Button>
                        )}
                        {confirmArchiveId === t.id ? (
                          <span className="flex items-center gap-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Archive?</span>
                            <button
                              onClick={() => { archive.mutate({ id: t.id, cardId }); setConfirmArchiveId(null) }}
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
                            onClick={() => setConfirmArchiveId(t.id)}
                            className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-xs transition-colors"
                            title="Archive transaction"
                            disabled={archive.isPending}
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {attachingTxId && (
        <AttachmentModal
          entityType="transaction"
          entityId={attachingTxId}
          readOnly={readOnly}
          onClose={() => setAttachingTxId(null)}
        />
      )}
    </>
  )
}
