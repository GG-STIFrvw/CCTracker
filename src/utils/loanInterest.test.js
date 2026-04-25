import { describe, it, expect } from 'vitest'
import {
  getActiveRate,
  computeInterestCharge,
  computeOutstanding,
  allocatePayment,
  isPeriodSufficientlyPaid,
  generateMissingEntries,
  getNextPeriodDate,
} from './loanInterest.js'

// ─── getActiveRate ────────────────────────────────────────────────────────────

describe('getActiveRate', () => {
  const rates = [
    { id: '1', effective_from: '2025-01-01', interest_rate: 4 },
    { id: '2', effective_from: '2025-06-01', interest_rate: 3.5 },
    { id: '3', effective_from: '2026-01-01', interest_rate: 3 },
  ]

  it('returns the most recent rate on or before date', () =>
    expect(getActiveRate(rates, '2025-08-01').id).toBe('2'))

  it('returns first rate when date is exactly effective_from', () =>
    expect(getActiveRate(rates, '2025-01-01').id).toBe('1'))

  it('returns null when no rate applies', () =>
    expect(getActiveRate(rates, '2024-12-31')).toBeNull())

  it('returns most recent when date is after all rates', () =>
    expect(getActiveRate(rates, '2099-01-01').id).toBe('3'))

  it('handles empty array', () =>
    expect(getActiveRate([], '2025-01-01')).toBeNull())
})

// ─── computeInterestCharge ───────────────────────────────────────────────────

describe('computeInterestCharge', () => {
  it('simple: always uses loanAmount regardless of principal paid', () => {
    expect(computeInterestCharge(79000, 70000, 4, 'simple')).toBe(3160)
  })

  it('diminishing: uses principalBalance', () => {
    expect(computeInterestCharge(79000, 70000, 4, 'diminishing')).toBe(2800)
  })

  it('simple: produces same charge after partial payment', () => {
    expect(computeInterestCharge(79000, 50000, 4, 'simple')).toBe(3160)
  })

  it('handles fractional rates without float error', () => {
    // 3.5% of 10000 = 350
    expect(computeInterestCharge(10000, 10000, 3.5, 'simple')).toBe(350)
  })

  it('rounds to nearest cent', () => {
    // 1.5% of 1 = 0.015 → rounds to 0.02 (half-up)
    expect(computeInterestCharge(1, 1, 1.5, 'simple')).toBe(0.02)
  })
})

// ─── computeOutstanding ──────────────────────────────────────────────────────

describe('computeOutstanding', () => {
  it('empty ledger: principalBalance equals loanAmount', () => {
    const out = computeOutstanding(79000, [])
    expect(out.principalBalance).toBe(79000)
    expect(out.interestBalance).toBe(0)
    expect(out.penaltyBalance).toBe(0)
    expect(out.total).toBe(79000)
  })

  it('interest_charge increases interestBalance', () => {
    const ledger = [
      { entry_type: 'interest_charge', amount: 3160, principal_applied: 0, interest_applied: 0, penalty_applied: 0 },
    ]
    const out = computeOutstanding(79000, ledger)
    expect(out.interestBalance).toBe(3160)
    expect(out.total).toBe(82160)
  })

  it('payment reduces all balances per allocation', () => {
    const ledger = [
      { entry_type: 'interest_charge', amount: 3160, principal_applied: 0, interest_applied: 0, penalty_applied: 0 },
      { entry_type: 'payment', amount: 7000, principal_applied: 3840, interest_applied: 3160, penalty_applied: 0 },
    ]
    const out = computeOutstanding(79000, ledger)
    expect(out.principalBalance).toBe(75160)
    expect(out.interestBalance).toBe(0)
    expect(out.total).toBe(75160)
  })

  it('penalty_waiver reduces penaltyBalance', () => {
    const ledger = [
      { entry_type: 'late_fee', amount: 500, principal_applied: 0, interest_applied: 0, penalty_applied: 0 },
      { entry_type: 'penalty_waiver', amount: 500, principal_applied: 0, interest_applied: 0, penalty_applied: 0 },
    ]
    const out = computeOutstanding(10000, ledger)
    expect(out.penaltyBalance).toBe(0)
  })

  it('balances never go below 0', () => {
    const ledger = [
      { entry_type: 'payment', amount: 999999, principal_applied: 999999, interest_applied: 0, penalty_applied: 0 },
    ]
    const out = computeOutstanding(1000, ledger)
    expect(out.principalBalance).toBe(0)
    expect(out.total).toBe(0)
  })
})

// ─── allocatePayment ─────────────────────────────────────────────────────────

describe('allocatePayment', () => {
  const outstanding = { principalBalance: 75000, interestBalance: 3160, penaltyBalance: 5000, total: 83160 }

  it('fills penalties first', () => {
    const alloc = allocatePayment(3000, outstanding)
    expect(alloc.penaltyApplied).toBe(3000)
    expect(alloc.interestApplied).toBe(0)
    expect(alloc.principalApplied).toBe(0)
  })

  it('fills interest after penalties are cleared', () => {
    const alloc = allocatePayment(8160, outstanding)
    expect(alloc.penaltyApplied).toBe(5000)
    expect(alloc.interestApplied).toBe(3160)
    expect(alloc.principalApplied).toBe(0)
  })

  it('remainder goes to principal after penalties and interest', () => {
    const alloc = allocatePayment(10000, outstanding)
    expect(alloc.penaltyApplied).toBe(5000)
    expect(alloc.interestApplied).toBe(3160)
    expect(alloc.principalApplied).toBe(1840)
  })

  it('caps principalApplied at principalBalance — no negative principal', () => {
    const small = { principalBalance: 100, interestBalance: 0, penaltyBalance: 0, total: 100 }
    const alloc = allocatePayment(99999, small)
    expect(alloc.principalApplied).toBe(100)
    expect(alloc.remainder).toBe(99899)
  })

  it('no-penalty no-interest: all goes to principal', () => {
    const noCharges = { principalBalance: 5000, interestBalance: 0, penaltyBalance: 0, total: 5000 }
    const alloc = allocatePayment(5000, noCharges)
    expect(alloc.principalApplied).toBe(5000)
    expect(alloc.penaltyApplied).toBe(0)
    expect(alloc.interestApplied).toBe(0)
  })
})

// ─── isPeriodSufficientlyPaid ─────────────────────────────────────────────────

describe('isPeriodSufficientlyPaid', () => {
  const ledger = [
    { entry_type: 'payment', amount: 2000, period_date: '2026-04-30' },
    { entry_type: 'payment', amount: 3000, period_date: '2026-04-30' },
    { entry_type: 'payment', amount: 7000, period_date: '2026-05-31' },
  ]

  it('minimumPayment null: any payment clears period', () => {
    expect(isPeriodSufficientlyPaid('2026-04-30', ledger, null)).toBe(true)
  })

  it('minimumPayment null: no payment → not paid', () => {
    expect(isPeriodSufficientlyPaid('2026-03-31', ledger, null)).toBe(false)
  })

  it('minimumPayment set: sums multiple payments in period', () => {
    // 2000 + 3000 = 5000 < 7000 → not paid
    expect(isPeriodSufficientlyPaid('2026-04-30', ledger, 7000)).toBe(false)
  })

  it('minimumPayment set: single full payment clears period', () => {
    expect(isPeriodSufficientlyPaid('2026-05-31', ledger, 7000)).toBe(true)
  })

  it('only counts payment entries, not other entry types', () => {
    const mixed = [
      { entry_type: 'interest_charge', amount: 9999, period_date: '2026-06-30' },
      { entry_type: 'payment', amount: 100, period_date: '2026-06-30' },
    ]
    expect(isPeriodSufficientlyPaid('2026-06-30', mixed, null)).toBe(true)
  })
})

// ─── generateMissingEntries ──────────────────────────────────────────────────

describe('generateMissingEntries', () => {
  const baseLoan = {
    id: 'loan-1',
    amount: 79000,
    loan_date: '2025-03-15',
    next_payment_date: '2025-04-30',
    payment_frequency: 'monthly',
    payment_day: 30,
    status: 'active',
    minimum_payment: 7000,
  }
  const rates = [
    {
      id: 'r1',
      effective_from: '2025-03-15',
      interest_rate: 4,
      interest_type: 'simple',
      late_fee_rate: 1,
      penalty_rate: 5,
    },
  ]

  it('returns [] for completed loan', () => {
    const loan = { ...baseLoan, status: 'completed' }
    expect(generateMissingEntries(loan, rates, [], '2026-04-25')).toHaveLength(0)
  })

  it('returns [] for defaulted loan', () => {
    const loan = { ...baseLoan, status: 'defaulted' }
    expect(generateMissingEntries(loan, rates, [], '2026-04-25')).toHaveLength(0)
  })

  it('returns [] when next_payment_date is null', () => {
    const loan = { ...baseLoan, next_payment_date: null }
    expect(generateMissingEntries(loan, rates, [], '2026-04-25')).toHaveLength(0)
  })

  it('returns [] when due date has not passed yet', () => {
    expect(generateMissingEntries(baseLoan, rates, [], '2025-04-29')).toHaveLength(0)
  })

  it('generates interest_charge for one missed period', () => {
    const entries = generateMissingEntries(baseLoan, rates, [], '2025-04-30')
    const charge = entries.find(e => e.entry_type === 'interest_charge')
    expect(charge).toBeDefined()
    expect(charge.amount).toBe(3160) // 79000 * 4%
    expect(charge.period_date).toBe('2025-04-30')
  })

  it('generates late_fee and penalty_interest for missed period (no payment)', () => {
    const entries = generateMissingEntries(baseLoan, rates, [], '2025-04-30')
    const types = entries.map(e => e.entry_type)
    expect(types).toContain('late_fee')
    expect(types).toContain('penalty_interest')
  })

  it('does NOT generate penalties when period is sufficiently paid', () => {
    const ledger = [
      { entry_type: 'payment', amount: 7000, period_date: '2025-04-30', principal_applied: 3840, interest_applied: 3160, penalty_applied: 0 },
    ]
    const entries = generateMissingEntries(baseLoan, rates, ledger, '2025-04-30')
    const types = entries.map(e => e.entry_type)
    expect(types).not.toContain('late_fee')
    expect(types).not.toContain('penalty_interest')
  })

  it('skips periods that already have interest_charge entries', () => {
    const ledger = [
      { entry_type: 'interest_charge', amount: 3160, period_date: '2025-04-30', principal_applied: 0, interest_applied: 0, penalty_applied: 0 },
    ]
    const entries = generateMissingEntries(baseLoan, rates, ledger, '2025-04-30')
    expect(entries.filter(e => e.entry_type === 'interest_charge')).toHaveLength(0)
  })

  it('generates entries for multiple missed periods in sequence', () => {
    const entries = generateMissingEntries(baseLoan, rates, [], '2025-06-30')
    const charges = entries.filter(e => e.entry_type === 'interest_charge')
    // April 30, May 30, June 30 = 3 periods (advanceNextPaymentDate keeps payment_day=30)
    expect(charges).toHaveLength(3)
    expect(charges[0].period_date).toBe('2025-04-30')
    expect(charges[1].period_date).toBe('2025-05-30')
    expect(charges[2].period_date).toBe('2025-06-30')
  })

  it('skips period when getActiveRate returns null (no applicable rate)', () => {
    const futureRates = [{ ...rates[0], effective_from: '2099-01-01' }]
    const entries = generateMissingEntries(baseLoan, futureRates, [], '2025-04-30')
    expect(entries).toHaveLength(0)
  })

  it('one-time loan: continues monthly cadence after due date if unpaid', () => {
    const oneTimeLoan = {
      ...baseLoan,
      payment_frequency: 'one-time',
      payment_day: null,
      next_payment_date: '2025-04-30',
    }
    const entries = generateMissingEntries(oneTimeLoan, rates, [], '2025-06-30')
    const charges = entries.filter(e => e.entry_type === 'interest_charge')
    expect(charges).toHaveLength(3)
    expect(charges[0].period_date).toBe('2025-04-30')
    expect(charges[1].period_date).toBe('2025-05-30')
    expect(charges[2].period_date).toBe('2025-06-30')
  })

  it('penalty amounts are computed on outstanding AFTER interest is added', () => {
    const entries = generateMissingEntries(baseLoan, rates, [], '2025-04-30')
    // outstanding before interest = 79000
    // interest_charge = 3160 → outstanding after = 82160
    // late_fee = 82160 * 1% = 821.60
    const lateFee = entries.find(e => e.entry_type === 'late_fee')
    expect(lateFee.amount).toBe(821.6)
  })
})

// ─── getNextPeriodDate ───────────────────────────────────────────────────────

describe('getNextPeriodDate', () => {
  it('monthly: advances to next month', () => {
    const loan = { payment_frequency: 'monthly', next_payment_date: '2026-04-30', payment_day: 30 }
    expect(getNextPeriodDate(loan)).toBe('2026-05-30')
  })

  it('weekly: advances by 7 days', () => {
    const loan = { payment_frequency: 'weekly', next_payment_date: '2026-04-25', payment_day: null }
    expect(getNextPeriodDate(loan)).toBe('2026-05-02')
  })

  it('one-time: advances monthly from due date', () => {
    const loan = { payment_frequency: 'one-time', next_payment_date: '2026-04-30', payment_day: null }
    expect(getNextPeriodDate(loan)).toBe('2026-05-30')
  })
})
