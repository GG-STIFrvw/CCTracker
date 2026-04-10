import { formatPeso } from '../../utils/money.js'

function barColor(pct) {
  if (pct >= 90) return '#ef4444' // red
  if (pct >= 75) return '#f59e0b' // amber
  return '#22c55e'                // green
}

export default function SpendingBar({ spent, limit, colorPrimary }) {
  const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0
  const color = pct >= 75 ? barColor(pct) : colorPrimary

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
        <span>{formatPeso(spent)}</span>
        <span>{formatPeso(limit)}</span>
      </div>
      <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="text-xs mt-1 text-right" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {pct.toFixed(0)}% used
      </div>
    </div>
  )
}
