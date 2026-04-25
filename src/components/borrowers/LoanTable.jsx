import { useState } from 'react'
import { getLoanTotalPaid, getLoanRemaining, isLoanOverdue } from '../../utils/loans.js'
import { computeOutstanding } from '../../utils/loanInterest.js'
import { formatPeso } from '../../utils/money.js'
import EditRateModal from './EditRateModal.jsx'
import LedgerStatementModal from './LedgerStatementModal.jsx'
import { SettingsIcon, LedgerIcon } from '../ui/icons.jsx'

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

export default function LoanTable({ loans, onPay, readOnly = false }) {
  const [editingRateLoan, setEditingRateLoan] = useState(null)
  const [statementLoan, setStatementLoan] = useState(null)

  if (loans.length === 0) {
    return <p className="text-gray-400 text-center py-10 text-sm">No loans yet. Click "+ Add Loan" to get started.</p>
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-right">Principal</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3 text-right">Interest Due</th>
              <th className="px-4 py-3 text-right">Penalties</th>
              <th className="px-4 py-3 text-right">Total Owed</th>
              <th className="px-4 py-3 text-left">Next Payment</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loans.map((loan) => {
              let principalBalance, totalPaid, interestBalance, penaltyBalance, totalOwed, overdue

              if (loan.interest_bearing) {
                const out = computeOutstanding(loan.amount, loan._ledger ?? [])
                principalBalance = out.principalBalance
                interestBalance = out.interestBalance
                penaltyBalance = out.penaltyBalance
                totalOwed = out.total
                totalPaid = (loan._ledger ?? [])
                  .filter((e) => e.entry_type === 'payment')
                  .reduce((sum, e) => sum + Number(e.amount), 0)
                overdue = isLoanOverdue(loan, loan.amount - principalBalance)
              } else {
                totalPaid = getLoanTotalPaid(loan.loan_payments)
                principalBalance = getLoanRemaining(loan.amount, totalPaid)
                interestBalance = null
                penaltyBalance = null
                totalOwed = principalBalance
                overdue = isLoanOverdue(loan, totalPaid)
              }

              const statusKey = overdue ? 'overdue' : loan.status
              const statusLabel = overdue ? 'Overdue' : loan.status.charAt(0).toUpperCase() + loan.status.slice(1)
              const pct = loan.amount > 0 ? Math.min(((loan.amount - principalBalance) / loan.amount) * 100, 100) : 0

              return (
                <tr key={loan.id} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{loan.description || '—'}</p>
                      {loan.notarized && <p className="text-gray-400 text-xs mt-0.5">Notarized</p>}
                      {loan.interest_bearing && loan._rates?.length > 0 && (() => {
                        const currentRate = [...loan._rates].sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0]
                        return (
                          <p className="text-[#9FE870] text-xs mt-0.5">
                            {currentRate.interest_rate}%/mo · {currentRate.interest_type === 'simple' ? 'Simple' : 'Diminishing'}
                          </p>
                        )
                      })()}
                      <div className="mt-1.5 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full w-32 overflow-hidden">
                        <div className={`h-full rounded-full ${progressBarColor(pct)}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{loan.loan_date}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-gray-900 dark:text-white whitespace-nowrap">{formatPeso(principalBalance)}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{formatPeso(totalPaid)}</td>
                  <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                    {interestBalance !== null
                      ? <span className="text-[#2D6A4F] dark:text-[#9FE870]">{formatPeso(interestBalance)}</span>
                      : <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                    {penaltyBalance !== null
                      ? penaltyBalance > 0
                        ? <span className="text-red-500">{formatPeso(penaltyBalance)}</span>
                        : <span className="text-gray-400">₱0.00</span>
                      : <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-white whitespace-nowrap">{formatPeso(totalOwed)}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{loan.next_payment_date || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[statusKey]}`}>{statusLabel}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {!readOnly && loan.status !== 'completed' && loan.status !== 'defaulted' && (
                        <button onClick={() => onPay(loan)}
                          className="text-[#2D6A4F] dark:text-[#9FE870] hover:text-[#9FE870] dark:hover:text-white text-xs font-semibold transition-colors">
                          Pay
                        </button>
                      )}
                      {!readOnly && loan.interest_bearing && (
                        <>
                          {loan.status !== 'completed' && loan.status !== 'defaulted' && (
                            <button onClick={() => setEditingRateLoan(loan)}
                              className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors" title="Edit interest rate">
                              <SettingsIcon className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => setStatementLoan(loan)}
                            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors" title="View statement">
                            <LedgerIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editingRateLoan && (
        <EditRateModal loan={editingRateLoan} onClose={() => setEditingRateLoan(null)} onSuccess={() => setEditingRateLoan(null)} />
      )}
      {statementLoan && (
        <LedgerStatementModal loan={statementLoan} onClose={() => setStatementLoan(null)} />
      )}
    </>
  )
}
