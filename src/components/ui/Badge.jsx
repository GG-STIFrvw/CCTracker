const statusStyles = {
  unpaid: 'bg-red-900/50 text-red-300 border border-red-700',
  partial: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700',
  paid: 'bg-green-900/50 text-green-300 border border-green-700',
}

const statusLabels = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
}

export default function Badge({ status }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[status] ?? statusStyles.unpaid}`}
    >
      {statusLabels[status] ?? status}
    </span>
  )
}
