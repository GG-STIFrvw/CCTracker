const statusStyles = {
  unpaid: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700',
  partial: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700',
  paid: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700',
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
