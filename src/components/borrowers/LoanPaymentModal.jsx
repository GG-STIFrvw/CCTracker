import { useRef, useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loanPaymentSchema } from '../../lib/zod-schemas.js'
import { useRecordLoanPayment } from '../../hooks/useLoans.js'
import {
  useUploadAttachment,
  useLoanPaymentAttachmentCounts,
  ALLOWED_TYPES,
  MAX_SIZE,
  MAX_FILES,
} from '../../hooks/useAttachments.js'
import { getLoanTotalPaid, getLoanRemaining } from '../../utils/loans.js'
import { computeOutstanding, allocatePayment } from '../../utils/loanInterest.js'
import { formatPeso } from '../../utils/money.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import AttachmentModal from '../ui/AttachmentModal.jsx'

export default function LoanPaymentModal({ loan, onClose, onSuccess }) {
  const recordPayment = useRecordLoanPayment()
  const fileInputRef = useRef(null)
  const [stagedFiles, setStagedFiles] = useState([])
  const [fileError, setFileError] = useState('')
  const [uploadWarning, setUploadWarning] = useState('')
  const [attachmentModalPaymentId, setAttachmentModalPaymentId] = useState(null)
  const uploadAttachment = useUploadAttachment()
  const loanPaymentIds = loan.loan_payments.map((p) => p.id)
  const { data: attachmentCounts } = useLoanPaymentAttachmentCounts(loanPaymentIds)

  // ── Interest-bearing outstanding ──────────────────────────────────────────
  const outstanding = useMemo(
    () => (loan.interest_bearing ? computeOutstanding(loan.amount, loan._ledger ?? []) : null),
    [loan]
  )

  // Non-interest remaining (existing path)
  const nonInterestRemaining = loan.interest_bearing
    ? null
    : getLoanRemaining(loan.amount, getLoanTotalPaid(loan.loan_payments))

  const maxPayment = loan.interest_bearing ? outstanding.total : nonInterestRemaining

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loanPaymentSchema),
    defaultValues: { amount: '', notes: '' },
  })

  const amountValue = watch('amount')

  const allocation = useMemo(() => {
    if (!loan.interest_bearing || !outstanding) return null
    const amt = Number(amountValue) || 0
    if (amt <= 0) return null
    return allocatePayment(Math.min(amt, outstanding.total), outstanding)
  }, [amountValue, outstanding, loan.interest_bearing])

  function handleFileSelect(e) {
    setFileError('')
    const files = Array.from(e.target.files || [])
    const slots = MAX_FILES - stagedFiles.length
    if (files.length > slots) { setFileError(`Maximum ${MAX_FILES} files allowed.`); e.target.value = ''; return }
    const invalid = files.filter((f) => !ALLOWED_TYPES.includes(f.type) || f.size > MAX_SIZE)
    if (invalid.length > 0) { setFileError('Only JPG, PNG, WEBP, PDF under 10 MB allowed.'); e.target.value = ''; return }
    setStagedFiles((prev) => [...prev, ...files])
    e.target.value = ''
  }

  function removeStagedFile(index) {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function onSubmit(values) {
    const amt = Number(values.amount)
    if (amt > maxPayment) return
    let result
    try {
      result = await recordPayment.mutateAsync({ loan, paymentAmount: amt, notes: values.notes || null })
    } catch (err) { console.error(err); return }

    if (stagedFiles.length > 0) {
      const failed = []
      for (const file of stagedFiles) {
        try {
          await uploadAttachment.mutateAsync({ file, entityType: 'loan_payment', entityId: result.loanPaymentId })
        } catch { failed.push(file.name) }
      }
      if (failed.length > 0) {
        setUploadWarning(`Payment saved. Receipt upload failed for: ${failed.join(', ')}. You can retry from payment history.`)
        return
      }
    }
    onSuccess?.()
    onClose()
  }

  return (
    <Modal title="Record Payment" onClose={onClose}>
      <p className="text-gray-400 text-sm mb-4">
        {loan.description || 'Loan'} · {loan.interest_bearing ? `Total owed: ${formatPeso(outstanding.total)}` : `Remaining: ${formatPeso(nonInterestRemaining)}`}
      </p>

      {/* Interest breakdown panel */}
      {loan.interest_bearing && outstanding && (
        <div className="mb-5 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden text-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide px-3 py-2 bg-gray-50 dark:bg-gray-800">
            Balance Breakdown
          </p>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            <div className="flex justify-between px-3 py-2">
              <span className="text-gray-600 dark:text-gray-300">Principal</span>
              <span className="font-mono text-gray-900 dark:text-white">{formatPeso(outstanding.principalBalance)}</span>
            </div>
            <div className="flex justify-between px-3 py-2">
              <span className="text-[#2D6A4F] dark:text-[#9FE870]">Interest Due</span>
              <span className="font-mono text-[#2D6A4F] dark:text-[#9FE870]">{formatPeso(outstanding.interestBalance)}</span>
            </div>
            {outstanding.penaltyBalance > 0 && (
              <div className="flex justify-between px-3 py-2">
                <span className="text-red-500">Penalties</span>
                <span className="font-mono text-red-500">{formatPeso(outstanding.penaltyBalance)}</span>
              </div>
            )}
            <div className="flex justify-between px-3 py-2 font-semibold">
              <span className="text-gray-900 dark:text-white">Total Owed</span>
              <span className="font-mono text-gray-900 dark:text-white">{formatPeso(outstanding.total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Payment history (non-interest) */}
      {!loan.interest_bearing && loan.loan_payments.length > 0 && (
        <div className="mb-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Payment History</p>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {[...loan.loan_payments]
              .sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
              .map((p) => (
                <div key={p.id} className="flex justify-between items-center px-3 py-2 bg-white dark:bg-gray-900">
                  <div>
                    <p className="text-sm text-gray-900 dark:text-white font-medium">{formatPeso(p.amount)}</p>
                    {p.notes && <p className="text-xs text-gray-400">{p.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs text-gray-400">{new Date(p.paid_at).toLocaleDateString('en-PH')}</p>
                    {(attachmentCounts?.[p.id] ?? 0) > 0 && (
                      <button type="button" onClick={() => setAttachmentModalPaymentId(p.id)}
                        className="text-gray-400 hover:text-blue-500 transition-colors text-base leading-none" title="View receipts">
                        📎
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Payment Amount (PHP)
          </label>
          <input
            {...register('amount')}
            type="number"
            step="0.01"
            max={maxPayment}
            placeholder={`Max ${formatPeso(maxPayment)}`}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
        </div>

        {/* Live allocation preview */}
        {loan.interest_bearing && allocation && (
          <div className="border border-[#9FE870]/30 rounded-lg overflow-hidden text-sm bg-[#9FE870]/5">
            <p className="text-xs text-[#2D6A4F] dark:text-[#9FE870] uppercase tracking-wide px-3 py-2">
              Payment Allocation Preview
            </p>
            <div className="divide-y divide-gray-100 dark:divide-gray-700/50 px-3 pb-2">
              <div className="flex justify-between py-1.5">
                <span className="text-red-500">→ Penalties</span>
                <span className="font-mono text-red-500">{formatPeso(allocation.penaltyApplied)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#2D6A4F] dark:text-[#9FE870]">→ Interest</span>
                <span className="font-mono text-[#2D6A4F] dark:text-[#9FE870]">{formatPeso(allocation.interestApplied)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-gray-600 dark:text-gray-300">→ Principal</span>
                <span className="font-mono text-gray-600 dark:text-gray-300">{formatPeso(allocation.principalApplied)}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 px-3 pb-2">
              New principal after payment:{' '}
              <span className="text-gray-900 dark:text-white font-mono">
                {formatPeso(Math.max(0, outstanding.principalBalance - allocation.principalApplied))}
              </span>
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
          <input {...register('notes')} placeholder="e.g. Cash, GCash"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Receipt upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Receipts (optional)</label>
          <div role="button" tabIndex={0}
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 text-center cursor-pointer hover:border-blue-400 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}>
            <span className="text-gray-500 dark:text-gray-400 text-sm">📎 Attach receipt</span>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5">JPG, PNG, PDF · max 10 MB · up to 10 files</p>
          </div>
          <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf" className="hidden" onChange={handleFileSelect} />
          {fileError && <p className="text-red-500 text-xs mt-1">{fileError}</p>}
          {stagedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {stagedFiles.map((f, i) => (
                <span key={i} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded-full px-2 py-0.5 border border-gray-200 dark:border-gray-700">
                  {f.name.length > 22 ? f.name.slice(0, 20) + '…' : f.name}
                  <button type="button" onClick={() => removeStagedFile(i)} className="text-gray-400 hover:text-red-500 ml-0.5 leading-none">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {recordPayment.error && <p className="text-red-500 text-sm">{recordPayment.error.message}</p>}
        {uploadWarning && (
          <p className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 text-xs rounded-lg px-3 py-2">
            {uploadWarning}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">{uploadWarning ? 'Close' : 'Cancel'}</Button>
          {!uploadWarning && (
            <Button type="submit" disabled={recordPayment.isPending || uploadAttachment.isPending || maxPayment <= 0} className="flex-1">
              {uploadAttachment.isPending ? 'Uploading receipts…' : recordPayment.isPending ? 'Recording…' : 'Record Payment'}
            </Button>
          )}
        </div>
      </form>

      {attachmentModalPaymentId && (
        <AttachmentModal entityType="loan_payment" entityId={attachmentModalPaymentId} onClose={() => setAttachmentModalPaymentId(null)} />
      )}
    </Modal>
  )
}
