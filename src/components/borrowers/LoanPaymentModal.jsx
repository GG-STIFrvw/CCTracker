import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loanPaymentSchema } from '../../lib/zod-schemas.js'
import { useRecordLoanPayment } from '../../hooks/useLoans.js'
import { getLoanTotalPaid, getLoanRemaining } from '../../utils/loans.js'
import { formatPeso } from '../../utils/money.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'

export default function LoanPaymentModal({ loan, onClose, onSuccess }) {
  const recordPayment = useRecordLoanPayment()
  const totalPaid = getLoanTotalPaid(loan.loan_payments)
  const remaining = getLoanRemaining(loan.amount, totalPaid)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loanPaymentSchema),
    defaultValues: { amount: '', notes: '' },
  })

  async function onSubmit(values) {
    if (Number(values.amount) > remaining) return
    try {
      await recordPayment.mutateAsync({
        loan,
        paymentAmount: Number(values.amount),
        notes: values.notes || null,
      })
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <Modal title="Record Payment" onClose={onClose}>
      <p className="text-gray-400 text-sm mb-5">
        {loan.description || 'Loan'} · Remaining: {formatPeso(remaining)}
      </p>

      {/* Payment history */}
      {loan.loan_payments.length > 0 && (
        <div className="mb-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Payment History</p>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {[...loan.loan_payments]
              .sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
              .map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between items-center px-3 py-2 bg-white dark:bg-gray-900"
                >
                  <div>
                    <p className="text-sm text-gray-900 dark:text-white font-medium">
                      {formatPeso(p.amount)}
                    </p>
                    {p.notes && <p className="text-xs text-gray-400">{p.notes}</p>}
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(p.paid_at).toLocaleDateString('en-PH')}
                  </p>
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
            max={remaining}
            placeholder={`Max ${formatPeso(remaining)}`}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes (optional)
          </label>
          <input
            {...register('notes')}
            placeholder="e.g. Cash, GCash"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {recordPayment.error && (
          <p className="text-red-500 text-sm">{recordPayment.error.message}</p>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={recordPayment.isPending || remaining <= 0}
            className="flex-1"
          >
            {recordPayment.isPending ? 'Recording…' : 'Record Payment'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
