import { addMoney, subtractMoney } from './money.js'

export function getLoanInitials(fullName) {
  // Trim, split on whitespace, filter empty, take first 2 words, get first char of each, uppercase
  const words = fullName.trim().split(/\s+/).filter(w => w.length > 0)
  return words.slice(0, 2).map(word => word[0].toUpperCase()).join('')
}

export function getLoanTotalPaid(payments = []) {
  // Sum all payment.amount using addMoney
  let total = 0
  for (const payment of payments) {
    total = addMoney(total, payment.amount)
  }
  return total
}

export function getLoanRemaining(loanAmount, totalPaid) {
  // Returns Math.max(0, subtractMoney(loanAmount, totalPaid))
  return Math.max(0, subtractMoney(loanAmount, totalPaid))
}

export function isLoanOverdue(loan, totalPaid) {
  // Returns true if ALL of:
  //   - loan.status is NOT 'completed' or 'defaulted'
  //   - loan.next_payment_date is not null
  //   - getLoanRemaining(loan.amount, totalPaid) > 0
  //   - loan.next_payment_date < today (YYYY-MM-DD string comparison)
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  // Check status - must not be completed or defaulted
  if (loan.status === 'completed' || loan.status === 'defaulted') {
    return false
  }

  // Check next_payment_date is not null
  if (loan.next_payment_date == null) {
    return false
  }

  // Check remaining balance > 0
  const remaining = getLoanRemaining(loan.amount, totalPaid)
  if (remaining <= 0) {
    return false
  }

  // Check if next_payment_date is in the past
  if (loan.next_payment_date >= today) {
    return false
  }

  return true
}

export function advanceNextPaymentDate(loan) {
  // loan has: { payment_frequency, next_payment_date, payment_day }
  // Returns null if next_payment_date is null
  if (loan.next_payment_date === null) {
    return null
  }

  // 'one-time': return next_payment_date unchanged
  if (loan.payment_frequency === 'one-time') {
    return loan.next_payment_date
  }

  // Helper to parse YYYY-MM-DD string as local date (not UTC)
  const parseLocalDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  // Helper to format Date as YYYY-MM-DD
  const formatDate = (date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // 'weekly': return next_payment_date + 7 days as YYYY-MM-DD
  if (loan.payment_frequency === 'weekly') {
    const date = parseLocalDate(loan.next_payment_date)
    date.setDate(date.getDate() + 7)
    return formatDate(date)
  }

  // 'monthly': advance by 1 month, set day to payment_day (or 30 if null),
  //            clamp to last day of that month
  if (loan.payment_frequency === 'monthly') {
    const date = parseLocalDate(loan.next_payment_date)
    const targetDay = loan.payment_day !== null ? loan.payment_day : 30

    // Calculate next month
    const currentYear = date.getFullYear()
    let currentMonth = date.getMonth()
    let nextMonth = currentMonth + 1
    let nextYear = currentYear
    if (nextMonth > 11) {
      nextMonth = 0
      nextYear += 1
    }

    // Create a new date in the target month/year with the target day
    const newDate = new Date(nextYear, nextMonth, targetDay)

    // Check if we overflowed to the next month
    if (newDate.getMonth() !== nextMonth) {
      // We overflowed, so use the last day of the target month instead
      // Create the first day of the month after next, then subtract 1 day
      const firstDayOfMonthAfter = new Date(nextYear, nextMonth + 1, 1)
      firstDayOfMonthAfter.setDate(firstDayOfMonthAfter.getDate() - 1)
      return formatDate(firstDayOfMonthAfter)
    }

    return formatDate(newDate)
  }

  throw new Error(`Unknown payment_frequency: "${loan.payment_frequency}"`)
}
