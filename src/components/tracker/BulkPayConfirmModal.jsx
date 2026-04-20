import { formatPeso } from '../../utils/money.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'

export default function BulkPayConfirmModal({ count, total, onConfirm, onCancel, isPending }) {
  return (
    <Modal title="Confirm Bulk Payment" onClose={onCancel}>
      <div className="flex flex-col gap-4">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-sm">
          <p className="text-gray-700 dark:text-gray-200">
            You are about to mark{' '}
            <span className="font-semibold text-gray-900 dark:text-white">{count} transaction{count !== 1 ? 's' : ''}</span>{' '}
            as fully paid.
          </p>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Total:{' '}
            <span className="font-mono font-semibold text-gray-900 dark:text-white">{formatPeso(total)}</span>
          </p>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          This action cannot be undone.
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Paying…' : 'Confirm Payment'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
