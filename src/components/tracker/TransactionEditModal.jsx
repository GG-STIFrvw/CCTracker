import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { transactionSchema } from '../../lib/zod-schemas.js'
import { useEditTransaction } from '../../hooks/useTransactions.js'
import { getRemainingBalance } from '../../utils/money.js'
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
  'bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9FE870] focus:border-transparent w-full transition-colors'

const today = new Date().toISOString().split('T')[0]

export default function TransactionEditModal({ transaction, card, transactions, onClose, onSuccess }) {
  const editTransaction = useEditTransaction()

  // Compute available credit excluding the transaction being edited
  const outstandingExcludingThis = transactions
    .filter(t => t.id !== transaction.id)
    .reduce((acc, t) => acc + getRemainingBalance(t.amount, t.amount_paid), 0)
  const maxAmount = (card?.spending_limit ?? Infinity) - outstandingExcludingThis

  const schema = transactionSchema.extend({
    amount: z.coerce
      .number({ invalid_type_error: 'Must be a number' })
      .positive('Amount must be greater than 0')
      .max(maxAmount, `Exceeds available credit (₱${maxAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })})`),
    transaction_date: z.string()
      .min(1, 'Date is required')
      .refine(d => d <= today, 'Transaction date cannot be in the future'),
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      transaction_date: transaction.transaction_date,
      amount: transaction.amount,
      payment_due_date: transaction.payment_due_date || '',
      notes: transaction.notes || '',
    },
  })

  async function onSubmit(data) {
    try {
      await editTransaction.mutateAsync({ id: transaction.id, cardId: transaction.card_id, data, currentAmountPaid: transaction.amount_paid })
      onSuccess?.()
      onClose()
    } catch {
      // error displayed via editTransaction.isError banner
    }
  }

  return (
    <Modal title="Edit Transaction" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        {editTransaction.isError && (
          <p className="bg-red-50 dark:bg-red-900/40 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-300 text-xs rounded-lg px-3 py-2">
            {editTransaction.error?.message}
          </p>
        )}

        <Field label="Date" error={errors.transaction_date?.message}>
          <input type="date" max={today} className={inputCls} {...register('transaction_date')} />
        </Field>

        <Field label="Amount (PHP)" error={errors.amount?.message}>
          <input type="number" step="0.01" min="0" placeholder="0.00" className={inputCls} {...register('amount')} />
        </Field>

        <Field label="Payment Due Date" error={errors.payment_due_date?.message}>
          <input type="date" className={inputCls} {...register('payment_due_date')} />
        </Field>

        <Field label="Notes (optional)" error={errors.notes?.message}>
          <input type="text" placeholder="Groceries, utilities…" className={inputCls} {...register('notes')} />
        </Field>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" disabled={editTransaction.isPending} className="flex-1">
            {editTransaction.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
