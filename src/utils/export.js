import { getRemainingBalance } from './money.js'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const CSV_HEADERS = ['Date', 'Amount (PHP)', 'Due Date', 'Paid (PHP)', 'Remaining (PHP)', 'Status', 'Notes']

export function buildCSVContent(transactions) {
  const rows = transactions.map(t => [
    t.transaction_date || '',
    t.amount,
    t.payment_due_date || '',
    t.amount_paid,
    getRemainingBalance(t.amount, t.amount_paid),
    t.payment_status,
    t.notes || '',
  ])
  return [CSV_HEADERS, ...rows]
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
      `PHP ${Number(t.amount_paid).toFixed(2)}`,
      `PHP ${getRemainingBalance(t.amount, t.amount_paid).toFixed(2)}`,
      t.payment_status,
      t.notes || '—',
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [45, 106, 79] },
  })

  doc.save(`${filename}.pdf`)
}
