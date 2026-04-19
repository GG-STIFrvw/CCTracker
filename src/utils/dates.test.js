import { describe, it, expect } from 'vitest'
import { getDueDateStatus } from './dates.js'

describe('getDueDateStatus', () => {
  it('returns null when no date provided', () => {
    expect(getDueDateStatus(null, 'unpaid')).toBe(null)
    expect(getDueDateStatus('', 'partial')).toBe(null)
  })

  it('returns null for paid transactions regardless of date', () => {
    expect(getDueDateStatus('2020-01-01', 'paid')).toBe(null)
    expect(getDueDateStatus('2099-12-31', 'paid')).toBe(null)
  })

  it('returns overdue for dates before today', () => {
    expect(getDueDateStatus('2020-06-15', 'unpaid')).toBe('overdue')
    expect(getDueDateStatus('2020-06-15', 'partial')).toBe('overdue')
  })

  it('returns due-soon for today', () => {
    const today = new Date().toISOString().split('T')[0]
    expect(getDueDateStatus(today, 'unpaid')).toBe('due-soon')
    expect(getDueDateStatus(today, 'partial')).toBe('due-soon')
  })

  it('returns due-soon for dates within 7 days', () => {
    const d = new Date()
    d.setDate(d.getDate() + 4)
    const dateStr = d.toISOString().split('T')[0]
    expect(getDueDateStatus(dateStr, 'unpaid')).toBe('due-soon')
  })

  it('returns due-soon for exactly 7 days away', () => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    const dateStr = d.toISOString().split('T')[0]
    expect(getDueDateStatus(dateStr, 'unpaid')).toBe('due-soon')
  })

  it('returns null for dates more than 7 days away', () => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    const dateStr = d.toISOString().split('T')[0]
    expect(getDueDateStatus(dateStr, 'unpaid')).toBe(null)
  })
})
