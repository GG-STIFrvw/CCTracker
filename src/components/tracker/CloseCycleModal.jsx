import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { billingCycleSchema } from '../../lib/zod-schemas.js'
import { useCloseCycle } from '../../hooks/useTransactions.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'

function Field({ label, error, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</label>
      {children}
      {error && <p className="text-red-500 dark:text-red-400 text-xs">{error}</p>}
    </div>
  )
}

const inputCls =
  'bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9FE870] focus:border-transparent w-full transition-colors'

function getDefaultLabel() {
  return new Date().toLocaleString('en-PH', { month: 'long', year: 'numeric' })
}

function getEarliestDate(transactions) {
  const dates = transactions.map(t => t.transaction_date).filter(Boolean).sort()
  return dates[0] || new Date().toISOString().split('T')[0]
}

function getLatestDate(transactions) {
  const dates = transactions.map(t => t.transaction_date).filter(Boolean).sort()
  return dates[dates.length - 1] || new Date().toISOString().split('T')[0]
}

export default function CloseCycleModal({ cardId, transactions, onClose, onSuccess }) {
  const closeCycle = useCloseCycle()

  const paidTransactions = transactions.filter(t => t.payment_status === 'paid')
  const unpaidCount = transactions.filter(t => t.payment_status !== 'paid').length

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(billingCycleSchema),
    defaultValues: {
      label: getDefaultLabel(),
      start_date: getEarliestDate(paidTransactions),
      end_date: getLatestDate(paidTransactions),
    },
  })

  async function onSubmit(data) {
    await closeCycle.mutateAsync({ cardId, ...data })
    onSuccess?.()
    onClose()
  }

  return (
    <Modal title="Close Billing Cycle" onClose={onClose}>
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 mb-4 text-sm space-y-1">
        <p className="text-gray-700 dark:text-gray-200">
          <span className="font-semibold text-[#2D6A4F] dark:text-[#9FE870]">{paidTransactions.length}</span> paid transaction{paidTransactions.length !== 1 ? 's' : ''} will be moved to history.
        </p>
        {unpaidCount > 0 && (
          <p className="text-amber-600 dark:text-amber-400 text-xs">
            {unpaidCount} unpaid transaction{unpaidCount !== 1 ? 's' : ''} will remain in Active.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        {closeCycle.isError && (
          <p className="bg-red-50 dark:bg-red-900/40 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-300 text-xs rounded-lg px-3 py-2">
            {closeCycle.error?.message}
          </p>
        )}

        <Field label="Cycle Label" error={errors.label?.message}>
          <input type="text" placeholder="April 2026" className={inputCls} {...register('label')} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start Date" error={errors.start_date?.message}>
            <input type="date" className={inputCls} {...register('start_date')} />
          </Field>
          <Field label="End Date" error={errors.end_date?.message}>
            <input type="date" className={inputCls} {...register('end_date')} />
          </Field>
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" disabled={closeCycle.isPending || paidTransactions.length === 0} className="flex-1">
            {closeCycle.isPending ? 'Closing…' : 'Close Cycle'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
