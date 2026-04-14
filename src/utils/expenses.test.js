import { describe, it, expect } from 'vitest'
import {
  CATEGORIES,
  PAYMENT_METHODS,
  getCategoryLabel,
  getPaymentMethodLabel,
  filterByMonth,
  groupByCategory,
  groupByPaymentMethod,
} from './expenses.js'

describe('getCategoryLabel', () => {
  it('returns human label for known category', () => {
    expect(getCategoryLabel('food')).toBe('Food & Dining')
  })
  it('returns human label for utilities', () => {
    expect(getCategoryLabel('utilities')).toBe('Utilities')
  })
  it('returns Others for unknown key', () => {
    expect(getCategoryLabel('unknown')).toBe('Others')
  })
})

describe('getPaymentMethodLabel', () => {
  it('returns GCash for gcash', () => {
    expect(getPaymentMethodLabel('gcash')).toBe('GCash')
  })
  it('returns Cash for cash', () => {
    expect(getPaymentMethodLabel('cash')).toBe('Cash')
  })
  it('returns Others for unknown key', () => {
    expect(getPaymentMethodLabel('unknown')).toBe('Others')
  })
})

describe('label helpers with null/undefined', () => {
  it('getCategoryLabel returns Others for null', () => {
    expect(getCategoryLabel(null)).toBe('Others')
  })
  it('getCategoryLabel returns Others for undefined', () => {
    expect(getCategoryLabel(undefined)).toBe('Others')
  })
  it('getPaymentMethodLabel returns Others for null', () => {
    expect(getPaymentMethodLabel(null)).toBe('Others')
  })
})

describe('filterByMonth', () => {
  const expenses = [
    { id: '1', expense_date: '2026-04-05', amount: 100 },
    { id: '2', expense_date: '2026-04-20', amount: 200 },
    { id: '3', expense_date: '2026-03-15', amount: 50 },
  ]
  it('returns only expenses in the given month/year', () => {
    const result = filterByMonth(expenses, 2026, 4)
    expect(result).toHaveLength(2)
    expect(result.map((e) => e.id)).toEqual(['1', '2'])
  })
  it('returns empty array when no match', () => {
    expect(filterByMonth(expenses, 2025, 1)).toHaveLength(0)
  })
  it('returns empty array for empty input', () => {
    expect(filterByMonth([], 2026, 4)).toHaveLength(0)
  })
})

describe('groupByCategory', () => {
  const expenses = [
    { category: 'food', amount: 300 },
    { category: 'food', amount: 200 },
    { category: 'utilities', amount: 1500 },
  ]
  it('sums amounts by category', () => {
    const result = groupByCategory(expenses)
    expect(result.food).toBe(500)
    expect(result.utilities).toBe(1500)
  })
  it('returns 0 for categories with no expenses', () => {
    const result = groupByCategory(expenses)
    expect(result.rent).toBe(0)
  })
  it('ignores expenses with an unknown category value', () => {
    const result = groupByCategory([{ category: 'not_real', amount: 999 }])
    const total = Object.values(result).reduce((a, b) => a + b, 0)
    expect(total).toBe(0)
  })
})

describe('groupByPaymentMethod', () => {
  const expenses = [
    { payment_method: 'cash', amount: 500 },
    { payment_method: 'gcash', amount: 300 },
    { payment_method: 'cash', amount: 200 },
  ]
  it('sums amounts by payment method', () => {
    const result = groupByPaymentMethod(expenses)
    expect(result.cash).toBe(700)
    expect(result.gcash).toBe(300)
  })
  it('returns 0 for methods with no expenses', () => {
    const result = groupByPaymentMethod(expenses)
    expect(result.maya).toBe(0)
  })
})

describe('CATEGORIES constant', () => {
  it('has 12 entries', () => {
    expect(CATEGORIES).toHaveLength(12)
  })
  it('each entry has value, label, color', () => {
    CATEGORIES.forEach((c) => {
      expect(c).toHaveProperty('value')
      expect(c).toHaveProperty('label')
      expect(c).toHaveProperty('color')
    })
  })
})

describe('PAYMENT_METHODS constant', () => {
  it('has 5 entries', () => {
    expect(PAYMENT_METHODS).toHaveLength(5)
  })
  it('each entry has value and label', () => {
    PAYMENT_METHODS.forEach((m) => {
      expect(m).toHaveProperty('value')
      expect(m).toHaveProperty('label')
    })
  })
})
