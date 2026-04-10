// All financial math uses integer cents to avoid IEEE 754 float errors

export function toCents(amount) {
  return Math.round(Number(amount) * 100)
}

export function fromCents(cents) {
  return cents / 100
}

export function addMoney(a, b) {
  return fromCents(toCents(a) + toCents(b))
}

export function subtractMoney(a, b) {
  return fromCents(toCents(a) - toCents(b))
}

export function formatPeso(amount) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(amount)
}

export function getPaymentStatus(amount, amountPaid) {
  const amountCents = toCents(amount)
  const paidCents = toCents(amountPaid)
  if (paidCents === 0) return 'unpaid'
  if (paidCents >= amountCents) return 'paid'
  return 'partial'
}

export function getRemainingBalance(amount, amountPaid) {
  return Math.max(0, subtractMoney(amount, amountPaid))
}
