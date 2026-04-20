import { getRemainingBalance } from './money.js'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export const CSV_HEADERS = ['Date', 'Amount (PHP)', 'Due Date', 'Paid (PHP)', 'Remaining (PHP)', 'Status', 'Notes']

function calcTotals(transactions) {
  return transactions.reduce(
    (acc, t) => {
      acc.amount += Number(t.amount) || 0
      acc.paid += Number(t.amount_paid ?? 0)
      acc.remaining += getRemainingBalance(t.amount, t.amount_paid ?? 0)
      return acc
    },
    { amount: 0, paid: 0, remaining: 0 }
  )
}

export function buildCSVContent(transactions) {
  const { amount, paid, remaining } = calcTotals(transactions)
  const rows = transactions.map(t => [
    t.transaction_date || '',
    t.amount,
    t.payment_due_date || '',
    t.amount_paid ?? 0,
    getRemainingBalance(t.amount, t.amount_paid ?? 0),
    t.payment_status,
    t.notes || '',
  ])
  const totalsRow = ['TOTALS', amount, '', paid, remaining, '', '']
  const blankRow = ['', '', '', '', '', '', '']
  return [CSV_HEADERS, ...rows, blankRow, totalsRow]
    .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

export function exportCSV(transactions, filename) {
  const csv = buildCSVContent(transactions)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportPDF(transactions, filename, title = 'Transactions') {
  const { amount, paid, remaining } = calcTotals(transactions)
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text(title, 14, 16)
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(`Exported ${new Date().toLocaleDateString('en-PH')}`, 14, 23)

  autoTable(doc, {
    startY: 28,
    head: [CSV_HEADERS],
    body: transactions.map(t => [
      t.transaction_date || '—',
      `PHP ${Number(t.amount).toFixed(2)}`,
      t.payment_due_date || '—',
      `PHP ${Number(t.amount_paid ?? 0).toFixed(2)}`,
      `PHP ${getRemainingBalance(t.amount, t.amount_paid ?? 0).toFixed(2)}`,
      t.payment_status,
      t.notes || '—',
    ]),
    foot: [['TOTALS', `PHP ${amount.toFixed(2)}`, '', `PHP ${paid.toFixed(2)}`, `PHP ${remaining.toFixed(2)}`, '', '']],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [45, 106, 79] },
    footStyles: { fillColor: [45, 106, 79], textColor: 255, fontStyle: 'bold' },
  })

  doc.save(`${filename}.pdf`)
}
