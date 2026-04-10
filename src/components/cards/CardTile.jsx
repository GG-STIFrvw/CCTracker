import { useNavigate } from 'react-router-dom'
import { useTransactions } from '../../hooks/useTransactions.js'
import { getRemainingBalance } from '../../utils/money.js'
import SpendingBar from './SpendingBar.jsx'

function sumOutstanding(transactions = []) {
  return transactions.reduce(
    (acc, t) => acc + getRemainingBalance(t.amount, t.amount_paid),
    0
  )
}

export default function CardTile({ card, onEdit }) {
  const navigate = useNavigate()
  const { data: transactions = [] } = useTransactions(card.id)
  const spent = sumOutstanding(transactions)

  const gradient = `linear-gradient(135deg, ${card.color_primary}, ${card.color_secondary})`

  return (
    <div
      className="relative rounded-2xl p-5 cursor-pointer shadow-xl hover:scale-[1.02] transition-transform select-none"
      style={{ background: gradient, minHeight: 190 }}
      onClick={() => navigate(`/tracker/${card.id}`)}
    >
      {/* Edit button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onEdit(card)
        }}
        className="absolute top-3 right-3 bg-black/20 hover:bg-black/40 text-white text-xs px-2 py-1 rounded-lg transition-colors"
      >
        Edit
      </button>

      {/* Bank + nickname */}
      <div className="mb-5">
        <p className="text-white/60 text-xs uppercase tracking-widest">{card.bank_name}</p>
        <p className="text-white font-semibold text-lg mt-0.5">{card.nickname}</p>
      </div>

      {/* Mock card number */}
      <p className="text-white/50 font-mono text-sm tracking-widest mb-4">
        •••• •••• •••• {card.mock_last4}
      </p>

      {/* Spending bar */}
      <SpendingBar
        spent={spent}
        limit={card.spending_limit}
        colorPrimary={card.color_primary}
      />

      {/* Footer */}
      <div className="flex justify-between items-end mt-3">
        <p className="text-white/60 text-xs uppercase tracking-wide">{card.cardholder_name}</p>
        <p className="text-white/50 text-xs font-mono">{card.expiry_display}</p>
      </div>
    </div>
  )
}
