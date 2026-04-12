import { getLoanTotalPaid, getLoanRemaining, isLoanOverdue } from '../../utils/loans.js'
import { formatPeso } from '../../utils/money.js'

const STATUS_STYLES = {
  active: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  completed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  defaulted: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  overdue: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
}

export default function LoanTable({ loans, onPay, readOnly = false }) {
  if (loans.length === 0) {
    return (
      <p className="text-gray-400 text-center py-10 text-sm">
        No loans yet. Click "+ Add Loan" to get started.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
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
                    <div className="mt-1.5 h-1 bg-gray-100 dark:bg-gray-700 rounded-full w-32">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {loan.loan_date}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white whitespace-nowrap">
                  {formatPeso(loan.amount)}
                </td>
                <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                  {formatPeso(totalPaid)}
                </td>
                <td className="px-4 py-3 text-right text-red-500 dark:text-red-400 whitespace-nowrap">
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
                <td className="px-4 py-3">
                  {!readOnly && loan.status !== 'completed' && loan.status !== 'defaulted' && (
                    <button
                      onClick={() => onPay(loan)}
                      className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 text-xs font-medium"
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
  )
}
