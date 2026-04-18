import { addMoney } from './money.js'

export const CATEGORIES = [
  { value: 'utilities',     label: 'Utilities',        color: '#3B82F6' },
  { value: 'food',          label: 'Food & Dining',    color: '#F59E0B' },
  { value: 'transportation',label: 'Transportation',   color: '#8B5CF6' },
  { value: 'rent',          label: 'Rent',             color: '#EC4899' },
  { value: 'healthcare',    label: 'Healthcare',       color: '#EF4444' },
  { value: 'shopping',      label: 'Shopping',         color: '#F97316' },
  { value: 'entertainment', label: 'Entertainment',    color: '#06B6D4' },
  { value: 'subscriptions', label: 'Subscriptions',    color: '#6366F1' },
  { value: 'education',     label: 'Education',        color: '#10B981' },
  { value: 'personal_care', label: 'Personal Care',    color: '#D946EF' },
  { value: 'insurance',     label: 'Insurance',        color: '#64748B' },
  { value: 'others',        label: 'Others',           color: '#9CA3AF' },
]

export const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'gcash',         label: 'GCash' },
  { value: 'maya',          label: 'Maya' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'others',        label: 'Others' },
]

export function getCategoryLabel(value) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? 'Others'
}

export function getPaymentMethodLabel(value) {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? 'Others'
}

export function filterByMonth(expenses, year, month) {
  return expenses.filter((e) => {
    const d = new Date(e.expense_date + 'T00:00:00')
    return d.getFullYear() === year && d.getMonth() + 1 === month
  })
}

export function groupByCategory(expenses) {
  const result = Object.fromEntries(CATEGORIES.map((c) => [c.value, 0]))
  for (const e of expenses) {
    if (result[e.category] !== undefined) {
      result[e.category] = addMoney(result[e.category], e.amount)
    }
  }
  return result
}

export function groupByPaymentMethod(expenses) {
  const result = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, 0]))
  for (const e of expenses) {
    if (result[e.payment_method] !== undefined) {
      result[e.payment_method] = addMoney(result[e.payment_method], e.amount)
    }
  }
  return result
}
