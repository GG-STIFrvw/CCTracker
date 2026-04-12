import { useState, useMemo } from 'react'
import { getLoanTotalPaid, getLoanRemaining, isLoanOverdue } from '../../utils/loans.js'
import { formatPeso } from '../../utils/money.js'
import { useLoanAttachmentCounts } from '../../hooks/useAttachments.js'
import AttachmentModal from '../ui/AttachmentModal.jsx'
import { AttachmentIcon } from '../ui/icons.jsx'

const STATUS_STYLES = {
  active: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  completed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  defaulted: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  overdue: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
}

function progressBarColor(pct) {
  if (pct >= 100) return 'bg-emerald-600'
  if (pct > 80) return 'bg-emerald-500'
  if (pct >= 50) return 'bg-amber-400'
  return 'bg-red-400'
}

export default function LoanTable({ loans, onPay, readOnly = false, borrowerId }) {
  const [attachingLoanId, setAttachingLoanId] = useState(null)

  const loanIds = useMemo(() => loans.map((l) => l.id), [loans])
  const { data: attCounts = {} } = useLoanAttachmentCounts(loanIds)

  if (loans.length === 0) {
    return (
      <p className="text-gray-400 text-center py-10 text-sm">
        No loans yet. Click "+ Add Loan" to get started.
      </p>
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3 text-right">Remaining</th>
              <th className="px-4 py-3 text-left">Next Payment</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-center">Files</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loans.map((loan) => {
              const totalPaid = getLoanTotalPaid(loan.loan_payments)
              const remaining = getLoanRemaining(loan.amount, totalPaid)
              const overdue = isLoanOverdue(loan, totalPaid)
              const statusKey = overdue ? 'overdue' : loan.status
              const statusLabel = overdue
                ? 'Overdue'
                : loan.status.charAt(0).toUpperCase() + loan.status.slice(1)
              const pct = loan.amount > 0 ? Math.min((totalPaid / loan.amount) * 100, 100) : 0
              const count = attCounts[loan.id] || 0

              return (
                <tr
                  key={loan.id}
                  className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {loan.description || '—'}
                      </p>
                      {loan.notarized && (
                        <p className="text-gray-400 text-xs mt-0.5">Notarized</p>
                      )}
                      <div className="mt-1.5 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full w-32 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${progressBarColor(pct)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {loan.loan_date}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-gray-900 dark:text-white whitespace-nowrap">
                    {formatPeso(loan.amount)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    {formatPeso(totalPaid)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-red-500 dark:text-red-400 whitespace-nowrap">
                    {formatPeso(remaining)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {loan.next_payment_date || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[statusKey]}`}
                    >
                      {statusLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {(!readOnly || count > 0) && (
                      <button
                        onClick={() => setAttachingLoanId(loan.id)}
                        className="inline-flex items-center gap-1 text-gray-400 hover:text-[#2D6A4F] dark:hover:text-[#9FE870] transition-colors text-xs"
                        title="Attachments"
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
                  <td className="px-4 py-3">
                    {!readOnly && loan.status !== 'completed' && loan.status !== 'defaulted' && (
                      <button
                        onClick={() => onPay(loan)}
                        className="text-[#2D6A4F] dark:text-[#9FE870] hover:text-[#9FE870] dark:hover:text-white text-xs font-semibold transition-colors"
                      >
                        Pay
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {attachingLoanId && (
        <AttachmentModal
          entityType="loan"
          entityId={attachingLoanId}
          borrowerId={borrowerId}
          readOnly={readOnly}
          onClose={() => setAttachingLoanId(null)}
        />
      )}
    </>
  )
}
