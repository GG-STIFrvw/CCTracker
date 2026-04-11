import { describe, it, expect } from 'vitest'
import {
  getLoanInitials,
  getLoanTotalPaid,
  getLoanRemaining,
  isLoanOverdue,
  advanceNextPaymentDate,
} from './loans.js'

describe('getLoanInitials', () => {
  it('returns two initials for two-word name', () =>
    expect(getLoanInitials('John Smith')).toBe('JS'))
  it('returns one initial for single-word name', () =>
    expect(getLoanInitials('Maria')).toBe('M'))
  it('only uses first two words', () =>
    expect(getLoanInitials('Juan dela Cruz')).toBe('JD'))
  it('handles extra spaces', () =>
    expect(getLoanInitials('  Ana  Torres  ')).toBe('AT'))
})

describe('getLoanTotalPaid', () => {
  it('returns 0 for empty payments', () =>
    expect(getLoanTotalPaid([])).toBe(0))
  it('sums correctly without float error', () =>
    expect(getLoanTotalPaid([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3))
  it('sums large amounts', () =>
    expect(getLoanTotalPaid([{ amount: 500 }, { amount: 250.50 }])).toBe(750.50))
  it('handles a single payment', () =>
    expect(getLoanTotalPaid([{ amount: 1000 }])).toBe(1000))
})

describe('getLoanRemaining', () => {
  it('returns loan amount minus total paid', () =>
    expect(getLoanRemaining(1000, 300)).toBe(700))
  it('never returns negative', () =>
    expect(getLoanRemaining(1000, 1500)).toBe(0))
  it('returns 0 when fully paid', () =>
    expect(getLoanRemaining(500, 500)).toBe(0))
})

describe('isLoanOverdue', () => {
  const pastDate = '2020-01-01'
  const futureDate = '2099-12-31'

  it('returns true when next_payment_date is past and remaining > 0', () =>
    expect(isLoanOverdue({ next_payment_date: pastDate, status: 'active', amount: 1000 }, 0)).toBe(true))
  it('returns false when next_payment_date is in future', () =>
    expect(isLoanOverdue({ next_payment_date: futureDate, status: 'active', amount: 1000 }, 0)).toBe(false))
  it('returns false when loan is completed', () =>
    expect(isLoanOverdue({ next_payment_date: pastDate, status: 'completed', amount: 1000 }, 1000)).toBe(false))
  it('returns false when loan is defaulted', () =>
    expect(isLoanOverdue({ next_payment_date: pastDate, status: 'defaulted', amount: 1000 }, 0)).toBe(false))
  it('returns false when no next_payment_date', () =>
    expect(isLoanOverdue({ next_payment_date: null, status: 'active', amount: 1000 }, 0)).toBe(false))
  it('returns false when remaining is 0 even if status is active', () =>
    expect(isLoanOverdue({ next_payment_date: '2020-01-01', status: 'active', amount: 1000 }, 1000)).toBe(false))
})

describe('advanceNextPaymentDate', () => {
  it('advances weekly by 7 days', () =>
    expect(
      advanceNextPaymentDate({ payment_frequency: 'weekly', next_payment_date: '2026-04-01', payment_day: null })
    ).toBe('2026-04-08'))

  it('advances monthly to same payment_day next month', () =>
    expect(
      advanceNextPaymentDate({ payment_frequency: 'monthly', next_payment_date: '2026-04-15', payment_day: 15 })
    ).toBe('2026-05-15'))

  it('clamps monthly payment_day=30 for February', () =>
    expect(
      advanceNextPaymentDate({ payment_frequency: 'monthly', next_payment_date: '2026-01-30', payment_day: 30 })
    ).toBe('2026-02-28'))

  it('returns same date for one-time frequency', () =>
    expect(
      advanceNextPaymentDate({ payment_frequency: 'one-time', next_payment_date: '2026-04-15', payment_day: null })
    ).toBe('2026-04-15'))

  it('returns null when next_payment_date is null', () =>
    expect(
      advanceNextPaymentDate({ payment_frequency: 'weekly', next_payment_date: null, payment_day: null })
    ).toBeNull())
})
