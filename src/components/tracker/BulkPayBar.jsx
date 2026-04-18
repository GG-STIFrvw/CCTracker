import { formatPeso } from '../../utils/money.js'
import Button from '../ui/Button.jsx'

export default function BulkPayBar({ selectedCount, selectedTotal, onPaySelected, onCancel, isPending }) {
  return (
    <div className="flex items-center justify-between bg-[#2D6A4F]/10 dark:bg-[#9FE870]/10 border border-[#2D6A4F]/30 dark:border-[#9FE870]/30 rounded-xl px-4 py-2.5 text-sm">
      <span className="text-gray-700 dark:text-gray-200">
        <span className="font-semibold text-[#2D6A4F] dark:text-[#9FE870]">{selectedCount}</span> selected
        {selectedCount > 0 && (
          <span className="ml-2 text-gray-500 dark:text-gray-400">· {formatPeso(selectedTotal)} remaining</span>
        )}
      </span>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          className="text-xs py-1.5 px-3"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          className="text-xs py-1.5 px-3"
          onClick={onPaySelected}
          disabled={selectedCount === 0 || isPending}
        >
          {isPending ? 'Paying…' : `Pay ${selectedCount > 0 ? selectedCount : ''} Selected`}
        </Button>
      </div>
    </div>
  )
}
