import { useState, useMemo, useEffect } from 'react'
import { formatPeso, getRemainingBalance } from '../../utils/money.js'
import { getDueDateStatus } from '../../utils/dates.js'
import { useArchiveTransaction, useRestoreTransaction } from '../../hooks/useTransactions.js'
import { useTransactionAttachmentCounts } from '../../hooks/useAttachments.js'
import AttachmentModal from '../ui/AttachmentModal.jsx'
import Badge from '../ui/Badge.jsx'
import Button from '../ui/Button.jsx'
import { AttachmentIcon, EditIcon } from '../ui/icons.jsx'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function TransactionTable({
  transactions,
  cardId,
  onPay,
  readOnly = false,
  bulkPayMode = false,
  selectedIds = new Set(),
  onToggleSelect,
  onEdit,
  mode = 'active',
}) {
  const archive = useArchiveTransaction()
  const restore = useRestoreTransaction()
  const [confirmArchiveId, setConfirmArchiveId] = useState(null)
  const [confirmRestoreId, setConfirmRestoreId] = useState(null)
  const [attachingTxId, setAttachingTxId] = useState(null)

  useEffect(() => {
    setConfirmArchiveId(null)
    setConfirmRestoreId(null)
  }, [mode])

  const txIds = useMemo(() => transactions.map((t) => t.id), [transactions])
  const { data: attCounts = {} } = useTransactionAttachmentCounts(txIds)

  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
        {readOnly
          ? 'No transactions.'
          : mode === 'archived'
          ? 'No archived transactions.'
          : 'No transactions yet. Add your first one above.'}
      </div>
    )
  }

  const rows = transactions.map((t) => ({
    t,
    count: attCounts[t.id] || 0,
    isSelectable: bulkPayMode && !readOnly && t.payment_status !== 'paid',
    isSelected: selectedIds.has(t.id),
    dueDateStatus: getDueDateStatus(t.payment_due_date, t.payment_status),
  }))

  return (
    <>
      {/* ── Mobile card list (below md) ──────────────────────────────── */}
      <div className="md:hidden flex flex-col divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        {rows.map(({ t, count, isSelectable, isSelected, dueDateStatus }) => {
          return (
            <div key={t.id} className="bg-white dark:bg-gray-900 px-4 py-3">
              {/* Row 1: date + status */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  {bulkPayMode && !readOnly && (
                    isSelectable ? (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect?.(t)}
                        className="accent-[#2D6A4F] dark:accent-[#9FE870] w-4 h-4 cursor-pointer flex-shrink-0"
                      />
                    ) : (
                      <span className="text-[#2D6A4F] dark:text-[#9FE870] text-xs w-4 flex-shrink-0">✓</span>
                    )
                  )}
                  <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(t.transaction_date)}</span>
                </div>
                <Badge status={t.payment_status} />
              </div>
              {/* Row 2: amount + remaining */}
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-base font-mono font-bold text-gray-900 dark:text-white">{formatPeso(t.amount)}</span>
                <span className="text-sm font-mono text-red-600 dark:text-red-400">
                  {formatPeso(getRemainingBalance(t.amount, t.amount_paid))} left
                </span>
              </div>
              {/* Row 3: due date + notes */}
              <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mb-2.5 flex-wrap">
                {t.payment_due_date && (
                  <span className={
                    dueDateStatus === 'overdue'
                      ? 'text-red-600 dark:text-red-400 font-semibold'
                      : dueDateStatus === 'due-soon'
                      ? 'text-orange-500 dark:text-orange-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }>
                    Due {formatDate(t.payment_due_date)}
                  </span>
                )}
                {t.payment_due_date && t.notes && <span>·</span>}
                {t.notes && <span className="truncate max-w-[160px]">{t.notes}</span>}
              </div>
              {/* Row 4: actions */}
              {!readOnly && (
                <div className="flex gap-2 items-center flex-wrap">
                  {count > 0 && (
                    <button
                      onClick={() => setAttachingTxId(t.id)}
                      className="flex items-center gap-1 text-gray-400 hover:text-[#2D6A4F] dark:hover:text-[#9FE870] text-xs transition-colors"
                      aria-label={`${count} attachment${count !== 1 ? 's' : ''}`}
                    >
                      <AttachmentIcon className="w-4 h-4" />
                      <span>{count}</span>
                    </button>
                  )}
                  {mode !== 'archived' && (
                    <button
                      onClick={() => onEdit?.(t)}
                      className="text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 px-2.5 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1"
                    >
                      <EditIcon className="w-3 h-3" /> Edit
                    </button>
                  )}
                  {mode !== 'archived' && t.payment_status !== 'paid' && (
                    <button
                      onClick={() => onPay(t)}
                      className="text-xs text-[#2D6A4F] dark:text-[#9FE870] border border-[#2D6A4F]/30 dark:border-[#9FE870]/30 px-2.5 py-1 rounded-lg hover:bg-[#9FE870]/10 transition-colors"
                    >
                      Pay
                    </button>
                  )}
                  <div className="ml-auto">
                    {mode === 'archived' ? (
                      confirmRestoreId === t.id ? (
                        <span className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Restore?</span>
                          <button
                            onClick={() => { restore.mutate({ id: t.id, cardId }); setConfirmRestoreId(null) }}
                            className="text-xs text-[#2D6A4F] dark:text-[#9FE870] font-medium"
                            disabled={restore.isPending}
                            aria-label="Confirm restore"
                          >Yes</button>
                          <span className="text-gray-300 dark:text-gray-600">/</span>
                          <button onClick={() => setConfirmRestoreId(null)} className="text-xs text-gray-400" aria-label="Cancel restore">No</button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmRestoreId(t.id)}
                          className="text-xs text-gray-400 hover:text-[#2D6A4F] dark:hover:text-[#9FE870] transition-colors"
                          disabled={restore.isPending}
                        >Restore</button>
                      )
                    ) : (
                      confirmArchiveId === t.id ? (
                        <span className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Archive?</span>
                          <button
                            onClick={() => { archive.mutate({ id: t.id, cardId }); setConfirmArchiveId(null) }}
                            className="text-xs text-red-500 font-medium"
                            disabled={archive.isPending}
                            aria-label="Confirm archive"
                          >Yes</button>
                          <span className="text-gray-300 dark:text-gray-600">/</span>
                          <button onClick={() => setConfirmArchiveId(null)} className="text-xs text-gray-400" aria-label="Cancel archive">No</button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmArchiveId(t.id)}
                          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                          disabled={archive.isPending}
                        >Archive</button>
                      )
                    )}
                  </div>
                </div>
              )}
              {readOnly && count > 0 && (
                <button
                  onClick={() => setAttachingTxId(t.id)}
                  className="flex items-center gap-1 text-gray-400 hover:text-[#2D6A4F] dark:hover:text-[#9FE870] text-xs transition-colors"
                  title="Attachments"
                  aria-label={`${count} attachment${count !== 1 ? 's' : ''}`}
                >
                  <AttachmentIcon className="w-4 h-4" />
                  <span className="bg-[#9FE870]/20 text-[#2D6A4F] dark:text-[#9FE870] text-xs font-medium px-1.5 py-0.5 rounded-full leading-none">
                    {count}
                  </span>
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Desktop table (md and up) ─────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
              {bulkPayMode && !readOnly && (
                <th className="px-4 py-3 text-center whitespace-nowrap w-10"></th>
              )}
              <th className="px-4 py-3 text-left whitespace-nowrap">Date</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">Amount</th>
              <th className="px-4 py-3 text-left whitespace-nowrap">Due Date</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">Paid</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">Remaining</th>
              <th className="px-4 py-3 text-center whitespace-nowrap">Status</th>
              <th className="px-4 py-3 text-left">Notes</th>
              <th className="px-4 py-3 text-center whitespace-nowrap">Invoice</th>
              {!readOnly && (
                <th className="px-4 py-3 text-center whitespace-nowrap">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map(({ t, count, isSelectable, isSelected, dueDateStatus }) => {
              return (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-gray-700 dark:text-gray-200">
                  {bulkPayMode && !readOnly && (
                    <td className="px-4 py-3 text-center">
                      {isSelectable ? (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelect?.(t)}
                          className="accent-[#2D6A4F] dark:accent-[#9FE870] w-4 h-4 cursor-pointer"
                        />
                      ) : (
                        <span className="text-[#2D6A4F] dark:text-[#9FE870] text-xs">✓</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(t.transaction_date)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatPeso(t.amount)}</td>
                  <td className={`px-4 py-3 whitespace-nowrap ${
                    dueDateStatus === 'overdue'
                      ? 'text-red-600 dark:text-red-400 font-semibold'
                      : dueDateStatus === 'due-soon'
                      ? 'text-orange-500 dark:text-orange-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
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
                        aria-label={`${count} attachment${count !== 1 ? 's' : ''}`}
                      >
                        <AttachmentIcon className="w-4 h-4" />
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
                      {mode === 'archived' ? (
                        <div className="flex gap-2 justify-center items-center">
                          {confirmRestoreId === t.id ? (
                            <span className="flex items-center gap-1">
                              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Restore?</span>
                              <button
                                onClick={() => { restore.mutate({ id: t.id, cardId }); setConfirmRestoreId(null) }}
                                className="text-xs text-[#2D6A4F] dark:text-[#9FE870] font-medium transition-colors"
                                disabled={restore.isPending}
                                aria-label="Confirm restore"
                              >
                                Yes
                              </button>
                              <span className="text-gray-300 dark:text-gray-600">/</span>
                              <button
                                onClick={() => setConfirmRestoreId(null)}
                                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                aria-label="Cancel restore"
                              >
                                No
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmRestoreId(t.id)}
                              className="text-xs text-gray-400 hover:text-[#2D6A4F] dark:hover:text-[#9FE870] transition-colors"
                              disabled={restore.isPending}
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex gap-2 justify-center items-center">
                          <button
                            onClick={() => onEdit?.(t)}
                            className="text-gray-400 hover:text-[#2D6A4F] dark:hover:text-[#9FE870] transition-colors"
                            title="Edit transaction"
                            aria-label="Edit transaction"
                          >
                            <EditIcon className="w-3.5 h-3.5" />
                          </button>
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
                                aria-label="Confirm archive"
                              >
                                Yes
                              </button>
                              <span className="text-gray-300 dark:text-gray-600">/</span>
                              <button
                                onClick={() => setConfirmArchiveId(null)}
                                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                aria-label="Cancel archive"
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
                      )}
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
