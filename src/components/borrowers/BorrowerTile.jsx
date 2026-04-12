import { useNavigate } from 'react-router-dom'
import { useLoans } from '../../hooks/useLoans.js'
import { getLoanInitials, getLoanTotalPaid, getLoanRemaining, isLoanOverdue } from '../../utils/loans.js'
import { formatPeso, addMoney } from '../../utils/money.js'

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-rose-500', 'bg-amber-500', 'bg-cyan-500',
]

function pickColor(name) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export default function BorrowerTile({ borrower, onEdit, readOnly = false }) {
  const navigate = useNavigate()
  const { data: loans = [] } = useLoans(borrower.id)

  const totalLoaned = loans.reduce((sum, l) => addMoney(sum, l.amount), 0)
  const totalPaid = loans.reduce((sum, l) => addMoney(sum, getLoanTotalPaid(l.loan_payments)), 0)
  const outstanding = loans.reduce(
    (sum, l) => addMoney(sum, getLoanRemaining(l.amount, getLoanTotalPaid(l.loan_payments))),
    0
  )

  const hasOverdue = loans.some((l) =>
    isLoanOverdue(l, getLoanTotalPaid(l.loan_payments))
  )

  const pct = totalLoaned > 0 ? Math.min((totalPaid / totalLoaned) * 100, 100) : 0

  const initials = getLoanInitials(borrower.full_name)
  const avatarColor = pickColor(borrower.full_name)

  return (
    <div
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/borrower/${borrower.id}${readOnly ? '?readOnly=true' : ''}`)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`${avatarColor} w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0`}
          >
            {initials}
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">
              {borrower.full_name}
            </p>
            <p className="text-gray-400 text-xs mt-0.5">{borrower.phone}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasOverdue && (
            <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium px-2 py-0.5 rounded-full">
              Overdue
            </span>
          )}
          {!readOnly && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit(borrower)
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wide">Loaned</p>
          <p className="text-gray-900 dark:text-white text-sm font-medium font-mono">{formatPeso(totalLoaned)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wide">Paid</p>
          <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium font-mono">{formatPeso(totalPaid)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wide">Outstanding</p>
          <p className="text-red-500 dark:text-red-400 text-sm font-medium font-mono">{formatPeso(outstanding)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 100 ? 'bg-emerald-600' : pct > 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-gray-400 text-xs mt-1 text-right">{Math.round(pct)}% repaid</p>
    </div>
  )
}
