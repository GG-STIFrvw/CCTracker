import { useRef, useState } from 'react'
import { formatPeso } from '../../utils/money.js'
import { ALLOWED_TYPES, MAX_SIZE, MAX_FILES } from '../../hooks/useAttachments.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'

export default function BulkPayConfirmModal({ count, total, onConfirm, onCancel, isPending }) {
  const fileInputRef = useRef(null)
  const [stagedFiles, setStagedFiles] = useState([])
  const [fileError, setFileError] = useState('')

  function handleFileSelect(e) {
    setFileError('')
    const files = Array.from(e.target.files || [])
    const slots = MAX_FILES - stagedFiles.length
    if (files.length > slots) {
      setFileError(`Maximum ${MAX_FILES} files allowed.`)
      e.target.value = ''
      return
    }
    const invalid = files.filter((f) => !ALLOWED_TYPES.includes(f.type) || f.size > MAX_SIZE)
    if (invalid.length > 0) {
      setFileError('Only JPG, PNG, WEBP, PDF under 10 MB allowed.')
      e.target.value = ''
      return
    }
    setStagedFiles((prev) => [...prev, ...files])
    e.target.value = ''
  }

  function removeStagedFile(index) {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index))
  }

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

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Receipts (optional)
          </label>
          <div
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-3 text-center cursor-pointer hover:border-[#9FE870] dark:hover:border-[#9FE870] transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            tabIndex={0}
            role="button"
          >
            <span className="text-gray-500 dark:text-gray-400 text-sm">📎 Attach receipt</span>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5">
              JPG, PNG, PDF · max 10 MB · up to 10 files · applied to all payments
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            className="hidden"
            onChange={handleFileSelect}
          />
          {fileError && (
            <p className="text-red-500 dark:text-red-400 text-xs">{fileError}</p>
          )}
          {stagedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {stagedFiles.map((f, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded-full px-2 py-0.5 border border-gray-200 dark:border-gray-700"
                >
                  {f.name.length > 22 ? f.name.slice(0, 20) + '…' : f.name}
                  <button
                    type="button"
                    onClick={() => removeStagedFile(i)}
                    className="text-gray-400 hover:text-red-500 ml-0.5 leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500">
          This action cannot be undone.
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={() => onConfirm(stagedFiles)} disabled={isPending}>
            {isPending ? 'Paying…' : 'Confirm Payment'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
