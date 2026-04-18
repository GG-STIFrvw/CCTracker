import { exportCSV, exportPDF } from '../../utils/export.js'
import Button from '../ui/Button.jsx'

export default function ExportButtons({ transactions, filename, title }) {
  if (!transactions || transactions.length === 0) return null

  return (
    <div className="flex gap-2">
      <Button
        variant="ghost"
        className="text-xs py-1.5 px-3"
        onClick={() => exportCSV(transactions, filename)}
        title="Export as CSV"
      >
        Export CSV
      </Button>
      <Button
        variant="ghost"
        className="text-xs py-1.5 px-3"
        onClick={() => exportPDF(transactions, filename, title)}
        title="Export as PDF"
      >
        Export PDF
      </Button>
    </div>
  )
}
