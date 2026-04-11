import { formatPeso, getRemainingBalance } from '../../utils/money.js'

function calcTotals(transactions = []) {
  return transactions.reduce(
    (acc, t) => ({
      totalSpent: acc.totalSpent + Number(t.amount),
      totalPaid: acc.totalPaid + Number(t.amount_paid),
      totalRemaining:
        acc.totalRemaining + getRemainingBalance(t.amount, t.amount_paid),
    }),
    { totalSpent: 0, totalPaid: 0, totalRemaining: 0 }
  )
}

function StatBox({ label, value, colorClass }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold font-mono ${colorClass}`}>{formatPeso(value)}</p>
    </div>
  )
}

export default function TrackerSummary({ card, transactions }) {
  const { totalSpent, totalPaid, totalRemaining } = calcTotals(transactions)

  return (
    <div className="sticky top-[57px] z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-700 px-4 py-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: card.color_primary }}
          />
          <h2 className="text-gray-900 dark:text-white font-semibold">{card.nickname}</h2>
          <span className="text-gray-500 dark:text-gray-500 text-sm">· {card.bank_name}</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <StatBox label="Total Charged" value={totalSpent} colorClass="text-gray-900 dark:text-white" />
          <StatBox label="Total Paid" value={totalPaid} colorClass="text-green-600 dark:text-green-400" />
          <StatBox label="Outstanding" value={totalRemaining} colorClass="text-red-600 dark:text-red-400" />
        </div>
      </div>
    </div>
  )
}
