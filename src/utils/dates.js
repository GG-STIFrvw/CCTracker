export function getDueDateStatus(dateStr, paymentStatus) {
  if (!dateStr || paymentStatus === 'paid') return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr + 'T00:00:00')
  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 7) return 'due-soon'
  return null
}
