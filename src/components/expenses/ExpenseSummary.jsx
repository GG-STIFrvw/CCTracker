import { formatPeso } from '../../utils/money.js'
import { PAYMENT_METHODS } from '../../utils/expenses.js'
import { ReturnIcon } from '../ui/icons.jsx'

export default function ExpenseSummary({ total, paymentTotals, monthLabel, onBack }) {
  return (
    <div className="sticky top-[57px] z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-700 px-4 py-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between mb-1">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {monthLabel} Total
          </p>
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ReturnIcon className="w-3.5 h-3.5" />
              Back to Dashboard
            </button>
          )}
        </div>
        <p className="text-3xl font-black font-mono text-red-600 dark:text-red-400 mb-3">
          {formatPeso(total)}
        </p>
        <div className="flex flex-wrap gap-4">
          {PAYMENT_METHODS.filter((m) => (paymentTotals[m.value] ?? 0) > 0).map((m) => (
            <div key={m.value} className="flex flex-col">
              <p className="text-xs text-gray-400 uppercase tracking-wide">{m.label}</p>
              <p className="text-sm font-mono font-semibold text-gray-700 dark:text-gray-200">
                {formatPeso(paymentTotals[m.value])}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
