import { describe, it, expect } from 'vitest'
import { buildCSVContent } from './export.js'

const sampleTransactions = [
  {
    id: '1',
    transaction_date: '2026-04-01',
    amount: 1500,
    payment_due_date: '2026-04-30',
    amount_paid: 500,
    payment_status: 'partial',
    notes: 'Groceries',
  },
  {
    id: '2',
    transaction_date: '2026-04-05',
    amount: 2000,
    payment_due_date: '',
    amount_paid: 2000,
    payment_status: 'paid',
    notes: '',
  },
]

describe('buildCSVContent', () => {
  it('includes a header row', () => {
    const csv = buildCSVContent(sampleTransactions)
    const firstLine = csv.split('\n')[0]
    expect(firstLine).toContain('Date')
    expect(firstLine).toContain('Amount')
    expect(firstLine).toContain('Status')
    expect(firstLine).toContain('Notes')
  })

  it('produces correct number of rows (header + data + blank + totals)', () => {
    const csv = buildCSVContent(sampleTransactions)
    const lines = csv.split('\n')
    expect(lines).toHaveLength(5) // 1 header + 2 data + 1 blank + 1 totals
  })

  it('includes transaction date and amount in data rows', () => {
    const csv = buildCSVContent(sampleTransactions)
    expect(csv).toContain('2026-04-01')
    expect(csv).toContain('1500')
  })

  it('computes remaining balance correctly', () => {
    const csv = buildCSVContent(sampleTransactions)
    // transaction 1: 1500 - 500 = 1000 remaining
    expect(csv).toContain('1000')
  })

  it('escapes double quotes in cell values', () => {
    const txWithQuotes = [{ ...sampleTransactions[0], notes: 'Say "hello"' }]
    const csv = buildCSVContent(txWithQuotes)
    expect(csv).toContain('Say ""hello""')
  })

  it('handles empty notes and due date gracefully', () => {
    const csv = buildCSVContent([sampleTransactions[1]])
    expect(csv).not.toContain('undefined')
    expect(csv).not.toContain('null')
  })
})

describe('buildCSVContent totals row', () => {
  it('includes a TOTALS row after the data', () => {
    const csv = buildCSVContent(sampleTransactions)
    expect(csv).toContain('TOTALS')
  })

  it('produces correct number of rows (header + data + blank + totals)', () => {
    const csv = buildCSVContent(sampleTransactions)
    const lines = csv.split('\n')
    // 1 header + 2 data + 1 blank + 1 totals = 5
    expect(lines).toHaveLength(5)
  })

  it('totals row contains correct summed amount', () => {
    const csv = buildCSVContent(sampleTransactions)
    // total amount: 1500 + 2000 = 3500
    expect(csv).toContain('3500')
  })

  it('totals row contains correct summed paid', () => {
    const csv = buildCSVContent(sampleTransactions)
    // total paid: 500 + 2000 = 2500
    expect(csv).toContain('2500')
  })

  it('totals row contains correct summed remaining', () => {
    const csv = buildCSVContent(sampleTransactions)
    // remaining: (1500-500) + (2000-2000) = 1000
    expect(csv).toContain('1000')
  })
})
