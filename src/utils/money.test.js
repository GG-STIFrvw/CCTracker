import { describe, it, expect } from 'vitest'
import {
  toCents,
  fromCents,
  addMoney,
  subtractMoney,
  formatPeso,
  getPaymentStatus,
  getRemainingBalance,
} from './money.js'

describe('toCents', () => {
  it('converts whole numbers', () => expect(toCents(100)).toBe(10000))
  it('converts decimals correctly', () => expect(toCents(9.99)).toBe(999))
  it('handles float imprecision (0.1 + 0.2)', () => expect(toCents(0.1 + 0.2)).toBe(30))
})

describe('fromCents', () => {
  it('converts cents back to peso', () => expect(fromCents(999)).toBe(9.99))
  it('converts zero', () => expect(fromCents(0)).toBe(0))
})

describe('addMoney', () => {
  it('adds correctly without float error', () => expect(addMoney(0.1, 0.2)).toBeCloseTo(0.3))
  it('adds large amounts', () => expect(addMoney(1000.50, 500.25)).toBe(1500.75))
})

describe('subtractMoney', () => {
  it('subtracts correctly', () => expect(subtractMoney(100, 30.50)).toBe(69.50))
  it('handles zero remainder', () => expect(subtractMoney(50, 50)).toBe(0))
})

describe('getPaymentStatus', () => {
  it('returns unpaid when nothing paid', () => expect(getPaymentStatus(1000, 0)).toBe('unpaid'))
  it('returns paid when fully paid', () => expect(getPaymentStatus(1000, 1000)).toBe('paid'))
  it('returns partial when partially paid', () => expect(getPaymentStatus(1000, 500)).toBe('partial'))
  it('returns paid when overpaid', () => expect(getPaymentStatus(1000, 1200)).toBe('paid'))
})

describe('getRemainingBalance', () => {
  it('returns correct remaining', () => expect(getRemainingBalance(1000, 300)).toBe(700))
  it('never returns negative', () => expect(getRemainingBalance(100, 200)).toBe(0))
  it('returns 0 when fully paid', () => expect(getRemainingBalance(500, 500)).toBe(0))
})

describe('formatPeso', () => {
  it('formats with PHP symbol', () => expect(formatPeso(1000)).toContain('1,000'))
  it('formats decimals', () => expect(formatPeso(9.99)).toContain('9.99'))
})
