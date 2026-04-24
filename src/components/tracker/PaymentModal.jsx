import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { paymentSchema } from '../../lib/zod-schemas.js'
import { useRecordPayment, usePaymentHistory } from '../../hooks/useTransactions.js'
import {
  useUploadAttachment,
  usePaymentAttachmentCounts,
  ALLOWED_TYPES,
  MAX_SIZE,
  MAX_FILES,
} from '../../hooks/useAttachments.js'
import { formatPeso, getRemainingBalance } from '../../utils/money.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import AttachmentModal from '../ui/AttachmentModal.jsx'

function formatDateTime(dt) {
  return new Date(dt).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const inputCls =
  'bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#9FE870] focus:border-transparent transition-colors'

export default function PaymentModal({ transaction, onClose, onSuccess }) {
  const remaining = getRemainingBalance(transaction.amount, transaction.amount_paid)
  const recordPayment = useRecordPayment()
  const { data: history = [] } = usePaymentHistory(transaction.id)

  const fileInputRef = useRef(null)
  const [stagedFiles, setStagedFiles] = useState([])
  const [fileError, setFileError] = useState('')
  const [uploadWarning, setUploadWarning] = useState('')
  const [attachmentModalPaymentId, setAttachmentModalPaymentId] = useState(null)
  const uploadAttachment = useUploadAttachment()
  const paymentIds = history.map((p) => p.id)
  const { data: attachmentCounts } = usePaymentAttachmentCounts(paymentIds)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: '', notes: '' },
  })

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

  async function onSubmit(data) {
    if (Number(data.amount) > remaining + 0.001) {
      alert(`Payment cannot exceed remaining balance of ${formatPeso(remaining)}`)
      return
    }
    const result = await recordPayment.mutateAsync({
      transaction,
      paymentAmount: Number(data.amount),
      notes: data.notes || '',
    })

    if (stagedFiles.length > 0) {
      const failed = []
      for (const file of stagedFiles) {
        try {
          await uploadAttachment.mutateAsync({
            file,
            entityType: 'payment',
            entityId: result.paymentId,
          })
        } catch {
          failed.push(file.name)
        }
      }
      if (failed.length > 0) {
        setUploadWarning(`Payment saved. Receipt upload failed for: ${failed.join(', ')}. You can retry from payment history.`)
        return
      }
    }

    onSuccess?.()
  }

  return (
    <Modal title="Record Payment" onClose={onClose}>
      {/* Transaction summary */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-500 dark:text-gray-400 text-xs mb-0.5">Original Amount</p>
          <p className="text-gray-900 dark:text-white font-mono">{formatPeso(transaction.amount)}</p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400 text-xs mb-0.5">Already Paid</p>
          <p className="text-green-600 dark:text-green-400 font-mono">{formatPeso(transaction.amount_paid)}</p>
        </div>
        <div className="col-span-2 pt-1 border-t border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 text-xs mb-0.5">Remaining Balance</p>
          <p className="text-red-600 dark:text-red-400 font-mono font-bold text-lg">{formatPeso(remaining)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        {recordPayment.isError && (
          <p className="bg-red-50 dark:bg-red-900/40 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-300 text-xs rounded-lg px-3 py-2">
            {recordPayment.error?.message}
          </p>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Payment Amount (PHP)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            className={inputCls}
            {...register('amount')}
          />
          {errors.amount && (
            <p className="text-red-500 dark:text-red-400 text-xs">{errors.amount.message}</p>
          )}
          <button
            type="button"
            className="text-[#2D6A4F] dark:text-[#9FE870] text-xs text-left hover:underline mt-0.5"
            onClick={() => setValue('amount', remaining.toString())}
          >
            Pay full remaining ({formatPeso(remaining)})
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Notes (optional)</label>
          <input
            type="text"
            placeholder="Bank transfer, GCash…"
            className={inputCls}
            {...register('notes')}
          />
        </div>

        {/* Receipt upload */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Receipts (optional)
          </label>
          <div
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-3 text-center cursor-pointer hover:border-[#9FE870] dark:hover:border-[#9FE870] transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="text-gray-500 dark:text-gray-400 text-sm">📎 Attach receipt</span>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5">
              JPG, PNG, PDF · max 10 MB · up to 10 files
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

        {uploadWarning && (
          <p className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 text-xs rounded-lg px-3 py-2">
            {uploadWarning}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            {uploadWarning ? 'Close' : 'Cancel'}
          </Button>
          {!uploadWarning && (
            <Button
              type="submit"
              disabled={recordPayment.isPending || uploadAttachment.isPending}
              className="flex-1"
            >
              {uploadAttachment.isPending
                ? 'Uploading receipts…'
                : recordPayment.isPending
                ? 'Recording…'
                : 'Record Payment'}
            </Button>
          )}
        </div>
      </form>

      {/* Payment history */}
      {history.length > 0 && (
        <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Payment History
          </p>
          <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
            {history.map((p) => (
              <div key={p.id} className="flex justify-between items-start text-sm gap-2">
                <div>
                  <span className="text-gray-700 dark:text-gray-300">{formatDateTime(p.paid_at)}</span>
                  {p.notes && (
                    <p className="text-gray-500 dark:text-gray-500 text-xs">{p.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-green-600 dark:text-green-400 font-mono">
                    {formatPeso(p.amount)}
                  </span>
                  {(attachmentCounts?.[p.id] ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => setAttachmentModalPaymentId(p.id)}
                      className="text-gray-400 hover:text-[#9FE870] transition-colors text-base leading-none"
                      title="View receipts"
                    >
                      📎
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {attachmentModalPaymentId && (
        <AttachmentModal
          entityType="payment"
          entityId={attachmentModalPaymentId}
          onClose={() => setAttachmentModalPaymentId(null)}
        />
      )}
    </Modal>
  )
}
